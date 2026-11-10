import { Medicine, Sale, SaleTotals } from './api';
import type { Connection } from './api';

const DB_NAME = 'medistock-phone-v1';
const DB_VERSION = 2;
const MEDICINES = 'medicines';
const SALES = 'sales';
const MOVEMENTS = 'movements';
const DEMANDS = 'demands';
export type MedicineDemand = { _id: string; name: string; form: string; strength: string; quantity: number; note: string; createdAt: string };
type Movement = { _id: string; medicineId: string; delta: number; reason: string; note?: string; createdAt: string; saleId?: string; totalPurchasePaisa?: number };
type SaleInput = { requestId: string; priceMode: 'retail'|'wholesale'; items: {medicineId:string;quantity:number}[] };
const makeId = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Phone local storage is unavailable. Open MediStock in a supported browser and install it to the home screen.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MEDICINES)) { const store = db.createObjectStore(MEDICINES, { keyPath: '_id' }); store.createIndex('normalizedName', 'normalizedName'); }
      if (!db.objectStoreNames.contains(SALES)) { const store = db.createObjectStore(SALES, { keyPath: '_id' }); store.createIndex('requestId', 'requestId', { unique: true }); store.createIndex('createdAt', 'createdAt'); }
      if (!db.objectStoreNames.contains(MOVEMENTS)) { const store = db.createObjectStore(MOVEMENTS, { keyPath: '_id' }); store.createIndex('medicineId', 'medicineId'); store.createIndex('saleId', 'saleId'); }
      if (!db.objectStoreNames.contains(DEMANDS)) db.createObjectStore(DEMANDS, { keyPath: '_id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open phone storage.'));
    request.onblocked = () => reject(new Error('Close other MediStock tabs and try again.'));
  });
}
function requestValue<T>(request: IDBRequest<T>) { return new Promise<T>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
function transactionDone(tx: IDBTransaction) { return new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error || new Error('Local transaction was cancelled.')); tx.onerror = () => reject(tx.error || new Error('Local transaction failed.')); }); }
function wrap<T>(data: T[], page: number, limit: number) { return { data, meta: { page, limit, total: data.length } }; }
function moneySafe(amount: number) { if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Price is outside the supported limit.'); return amount; }

export const offlineStore = {
  async exportBackup() {
    const db=await openDb();try{const [medicines,sales,movements,demands]=await Promise.all([requestValue<Medicine[]>(db.transaction(MEDICINES).objectStore(MEDICINES).getAll()),requestValue<Sale[]>(db.transaction(SALES).objectStore(SALES).getAll()),requestValue<Movement[]>(db.transaction(MOVEMENTS).objectStore(MOVEMENTS).getAll()),requestValue<MedicineDemand[]>(db.transaction(DEMANDS).objectStore(DEMANDS).getAll())]);return {format:'medistock-phone-backup-v1',exportedAt:new Date().toISOString(),medicines,sales,movements,demands};}finally{db.close();}
  },
  async importBackup(file:File) {
    const parsed=JSON.parse(await file.text());if(parsed.format!=='medistock-phone-backup-v1'||!Array.isArray(parsed.medicines)||!Array.isArray(parsed.sales)||!Array.isArray(parsed.movements))throw new Error('This is not a valid MediStock phone backup.');
    const db=await openDb();try{const tx=db.transaction([MEDICINES,SALES,MOVEMENTS,DEMANDS],'readwrite');for(const name of [MEDICINES,SALES,MOVEMENTS,DEMANDS])tx.objectStore(name).clear();for(const row of parsed.medicines)tx.objectStore(MEDICINES).put(row);for(const row of parsed.sales)tx.objectStore(SALES).put(row);for(const row of parsed.movements)tx.objectStore(MOVEMENTS).put(row);for(const row of parsed.demands||[])tx.objectStore(DEMANDS).put(row);await transactionDone(tx);}finally{db.close();}
  },
  async request<T>(_connection: Connection, path: string, options: RequestInit = {}): Promise<T> {
    const method = (options.method || 'GET').toUpperCase();
    const url = new URL(path, 'http://offline.local');
    const id = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) || '');
    const segments = url.pathname.split('/').filter(Boolean);
    const body = options.body ? JSON.parse(String(options.body)) : {};
    const db = await openDb();
    try {
      if (url.pathname === '/health') return { data: { ready: true } } as T;
      if (segments[0] === 'demands' && segments.length === 1 && method === 'GET') {
        const rows = await requestValue<MedicineDemand[]>(db.transaction(DEMANDS).objectStore(DEMANDS).getAll());
        return { data: rows.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)), meta:{total:rows.length} } as T;
      }
      if (url.pathname === '/demands' && method === 'POST') {
        const name=String(body.name||'').trim(),quantity=Number(body.quantity);
        if(!name)throw new Error('Medicine ka naam likhein.');
        if(!Number.isInteger(quantity)||quantity<1||quantity>1000000000)throw new Error('Demand quantity 1 ya us se zyada honi chahiye.');
        const demand:MedicineDemand={_id:makeId(),name,form:String(body.form||''),strength:String(body.strength||''),quantity,note:String(body.note||'').trim(),createdAt:new Date().toISOString()};
        const tx=db.transaction(DEMANDS,'readwrite');tx.objectStore(DEMANDS).add(demand);await transactionDone(tx);return {data:demand} as T;
      }
      if (segments[0] === 'demands' && segments[1] && method === 'DELETE') {
        const tx=db.transaction(DEMANDS,'readwrite');tx.objectStore(DEMANDS).delete(segments[1]);await transactionDone(tx);return {data:{_id:segments[1]}} as T;
      }
      if (url.pathname === '/stock/summary' && method === 'GET') {
        const rows = await requestValue<Medicine[]>(db.transaction(MEDICINES).objectStore(MEDICINES).getAll());
        return { data: { totalUnits: rows.filter(row => !row.archived).reduce((sum,row) => sum + row.quantity,0) } } as T;
      }
      if (url.pathname === '/medicines' && method === 'GET') {
        const all = await requestValue<Medicine[]>(db.transaction(MEDICINES).objectStore(MEDICINES).getAll());
        const q = url.searchParams.get('search')?.trim().toLocaleLowerCase() || '';
        const rows = all.filter(row => !row.archived && (!q || row.name.toLocaleLowerCase().startsWith(q) || row.barcode === url.searchParams.get('search'))).sort((a,b)=>a.name.localeCompare(b.name));
        const page = Math.max(1,Number(url.searchParams.get('page')||1)), limit=Math.max(1,Number(url.searchParams.get('limit')||25));
        return wrap(rows.slice((page-1)*limit,page*limit),page,limit) as T;
      }
      if (url.pathname === '/stock/low' && method === 'GET') {
        const all=await requestValue<Medicine[]>(db.transaction(MEDICINES).objectStore(MEDICINES).getAll());
        const rows=all.filter(row=>!row.archived&&row.quantity<=row.minimumStock).sort((a,b)=>a.quantity-b.quantity||a.name.localeCompare(b.name));
        const page=Math.max(1,Number(url.searchParams.get('page')||1)),limit=Math.max(1,Number(url.searchParams.get('limit')||25));
        return wrap(rows.slice((page-1)*limit,page*limit),page,limit) as T;
      }
      if (url.pathname === '/sales' && method === 'GET') {
        const all=await requestValue<Sale[]>(db.transaction(SALES).objectStore(SALES).getAll());
        const from=url.searchParams.get('from'),to=url.searchParams.get('to');
        const matches=all.filter(s=>{const day=new Date(s.createdAt).toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'});return (!from||day>=from)&&(!to||day<=to);}).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
        const active=matches.filter(s=>!s.voidedAt),byDay=new Map<string,{_id:string;totalPaisa:number;invoices:number;units:number}>();
        for(const s of active){const day=new Date(s.createdAt).toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'});const row=byDay.get(day)||{_id:day,totalPaisa:0,invoices:0,units:0};row.totalPaisa+=s.totalPaisa;row.invoices++;row.units+=s.items.reduce((n,x)=>n+x.quantity,0);byDay.set(day,row);}
        const page=Math.max(1,Number(url.searchParams.get('page')||1)),limit=Math.max(1,Number(url.searchParams.get('limit')||25));
        const summary:SaleTotals=active.reduce((out,s)=>({totalPaisa:out.totalPaisa+s.totalPaisa,invoices:out.invoices+1,units:out.units+s.items.reduce((n,x)=>n+x.quantity,0)}),{totalPaisa:0,invoices:0,units:0});
        return {data:matches.slice((page-1)*limit,page*limit),meta:{page,limit,total:matches.length,summary,daily:[...byDay.values()].sort((a,b)=>b._id.localeCompare(a._id))}} as T;
      }
      if (segments[0]==='medicines' && segments[1] && method === 'PATCH') {
        const tx=db.transaction(MEDICINES,'readwrite'),store=tx.objectStore(MEDICINES),medicine=await requestValue<Medicine|undefined>(store.get(segments[1]));
        if(!medicine)throw new Error('Medicine not found.');
        const updated={...medicine,...body,updatedAt:new Date().toISOString()};store.put(updated);await transactionDone(tx);return {data:updated} as T;
      }
      if (url.pathname==='/medicines'&&method==='POST') {
        const tx=db.transaction([MEDICINES,MOVEMENTS],'readwrite'),store=tx.objectStore(MEDICINES),now=new Date().toISOString();
        const medicine:Medicine={_id:makeId(),...body,archived:false,createdAt:now,updatedAt:now,purchasePricePaisa:body.quantity?Math.round(body.totalPurchasePaisa/body.quantity):0};
        store.add(medicine);tx.objectStore(MOVEMENTS).add({_id:makeId(),medicineId:medicine._id,delta:medicine.quantity,reason:'opening',createdAt:now,totalPurchasePaisa:body.totalPurchasePaisa} satisfies Movement);await transactionDone(tx);return {data:medicine} as T;
      }
      if(segments[0]==='medicines'&&segments[1]&&segments[2]==='restock'&&method==='POST'){
        const tx=db.transaction([MEDICINES,MOVEMENTS],'readwrite'),store=tx.objectStore(MEDICINES),medicine=await requestValue<Medicine|undefined>(store.get(segments[1]));if(!medicine||medicine.archived)throw new Error('Medicine not found.');
        const updated={...medicine,quantity:medicine.quantity+body.quantity,purchasePricePaisa:body.quantity?Math.round(body.totalPurchasePaisa/body.quantity):medicine.purchasePricePaisa,updatedAt:new Date().toISOString()};store.put(updated);tx.objectStore(MOVEMENTS).add({_id:makeId(),medicineId:medicine._id,delta:body.quantity,reason:'restock',note:body.note,createdAt:new Date().toISOString(),totalPurchasePaisa:body.totalPurchasePaisa} satisfies Movement);await transactionDone(tx);return {data:updated} as T;
      }
      if(segments[0]==='medicines'&&segments[1]&&segments[2]==='adjustments'&&method==='POST'){
        const tx=db.transaction([MEDICINES,MOVEMENTS],'readwrite'),store=tx.objectStore(MEDICINES),medicine=await requestValue<Medicine|undefined>(store.get(segments[1]));if(!medicine||medicine.archived)throw new Error('Medicine not found.');if(medicine.quantity+body.delta<0)throw new Error(`${medicine.name}: stock sirf ${medicine.quantity} units hai.`);
        const updated={...medicine,quantity:medicine.quantity+body.delta,updatedAt:new Date().toISOString()};store.put(updated);tx.objectStore(MOVEMENTS).add({_id:makeId(),medicineId:medicine._id,delta:body.delta,reason:'adjustment',note:body.note,createdAt:new Date().toISOString()} satisfies Movement);await transactionDone(tx);return {data:updated} as T;
      }
      if(url.pathname==='/sales'&&method==='POST'){
        const input=body as SaleInput,tx=db.transaction([MEDICINES,SALES,MOVEMENTS],'readwrite'),meds=tx.objectStore(MEDICINES),sales=tx.objectStore(SALES),existing=await requestValue<Sale|undefined>(sales.index('requestId').get(input.requestId));
        if(existing){return {data:existing,meta:{replayed:true,stockUpdates:[]}} as T;}
        const grouped=new Map<string,number>();for(const line of input.items)grouped.set(line.medicineId,(grouped.get(line.medicineId)||0)+line.quantity);
        const lines:Sale['items']=[],updates:{medicineId:string;quantity:number}[]=[];let totalPaisa=0;const saleId=makeId(),now=new Date().toISOString();
        for(const [medicineId,quantity] of grouped){const med=await requestValue<Medicine|undefined>(meds.get(medicineId));if(!med||med.archived)throw new Error('Medicine not found or archived.');if(!Number.isInteger(quantity)||quantity<1||quantity>med.quantity)throw new Error(`${med.name}: ${med.quantity} units available hain, ${quantity} enter kiye.`);const unitPricePaisa=input.priceMode==='wholesale'?med.wholesalePricePaisa:med.retailPricePaisa,lineTotal=moneySafe(unitPricePaisa*quantity);totalPaisa=moneySafe(totalPaisa+lineTotal);lines.push({medicineId,nameSnapshot:med.name,strengthSnapshot:`${med.strength} ${med.strengthUnit}`,quantity,unitPricePaisa,totalPaisa:lineTotal});const updated={...med,quantity:med.quantity-quantity,updatedAt:now};meds.put(updated);updates.push({medicineId,quantity:updated.quantity});tx.objectStore(MOVEMENTS).add({_id:makeId(),medicineId,saleId,delta:-quantity,reason:'sale',createdAt:now});}
        const sale:Sale={_id:saleId,requestId:input.requestId,fingerprint:'offline',invoiceNumber:`INV-${makeId().slice(0,12).toUpperCase()}`,priceMode:input.priceMode,items:lines,totalPaisa,createdAt:now};sales.add(sale);await transactionDone(tx);return {data:sale,meta:{replayed:false,stockUpdates:updates}} as T;
      }
      if(segments[0]==='sales'&&segments[1]&&method==='GET'){const sale=await requestValue<Sale|undefined>(db.transaction(SALES).objectStore(SALES).get(segments[1]));if(!sale)throw new Error('Invoice not found.');return {data:sale} as T;}
      if(segments[0]==='sales'&&segments[1]&&method==='DELETE'){
        const tx=db.transaction([MEDICINES,SALES,MOVEMENTS],'readwrite'),sales=tx.objectStore(SALES),sale=await requestValue<Sale|undefined>(sales.get(segments[1]));if(!sale)throw new Error('Invoice not found.');if(sale.voidedAt){tx.abort();throw new Error('Invoice already deleted.');}
        for(const line of sale.items){const med=await requestValue<Medicine|undefined>(tx.objectStore(MEDICINES).get(line.medicineId));if(med){tx.objectStore(MEDICINES).put({...med,quantity:med.quantity+line.quantity,updatedAt:new Date().toISOString()});tx.objectStore(MOVEMENTS).add({_id:makeId(),medicineId:line.medicineId,saleId:sale._id,delta:line.quantity,reason:'sale_void',note:`Deleted invoice ${sale.invoiceNumber}`,createdAt:new Date().toISOString()} satisfies Movement);}}
        const updated={...sale,voidedAt:new Date().toISOString()};sales.put(updated);await transactionDone(tx);return {data:updated} as T;
      }
      throw new Error(`This offline action is not supported yet: ${method} ${url.pathname}`);
    } catch(error) { throw error; }
    finally { db.close(); }
  },
  async listMedicines() { const db=await openDb();try{return await requestValue<Medicine[]>(db.transaction(MEDICINES).objectStore(MEDICINES).getAll());}finally{db.close();} }
};
