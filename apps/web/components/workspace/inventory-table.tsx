'use client';

import { ClipboardPlus, Package, Pill, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Medicine, money } from '../../lib/api';
import { Empty } from './ui';

type Props = {
  medicines: Medicine[];
  compact?: boolean;
  loading?: boolean;
  emptyText?: string;
  onRestock: (medicine: Medicine) => void;
  onEdit?: (medicine: Medicine) => void;
  onDelete?: (medicine: Medicine) => void;
  onDemand?: (medicine: Medicine) => void;
  deleteDisabled?: boolean;
};

export function InventoryTable({ medicines, compact = false, loading = false, emptyText = 'Add your first medicine, or try a different name.', onRestock, onEdit, onDelete, onDemand, deleteDisabled = false }: Props) {
  return <div className="table-scroll"><table><thead><tr><th>Medicine</th><th>Available stock</th>{!compact && <th>Retail / unit</th>}<th>{compact ? 'Minimum stock' : 'Wholesale / unit'}</th>{!compact && <th>Alert at</th>}<th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{medicines.map(medicine => <tr key={medicine._id}><td><div className="medicine-cell"><span className={`medicine-icon ${medicine.form === 'Injection' ? 'blue' : ''}`}><Pill size={19}/></span><div><strong>{medicine.name}</strong><small>{medicine.form} · {medicine.strength} {medicine.strengthUnit}{!compact && medicine.barcode ? ` · ${medicine.barcode}` : ''}</small></div></div></td><td><b className="stock-number">{medicine.quantity.toLocaleString()}</b><span className="cell-unit"> units</span></td>{!compact && <td>{money(medicine.retailPricePaisa)}</td>}<td>{compact ? `${medicine.minimumStock} units` : money(medicine.wholesalePricePaisa)}</td>{!compact && <td><b>{medicine.minimumStock}</b> units or less</td>}<td><span className={`badge ${medicine.quantity === 0 ? 'red' : medicine.quantity <= medicine.minimumStock ? 'amber' : 'green'}`}><i/>{medicine.quantity === 0 ? 'Out of stock' : medicine.quantity <= medicine.minimumStock ? 'Low stock' : 'In stock'}</span></td><td><div className="row-actions"><button className="text-button" onClick={() => onRestock(medicine)}>Restock <Plus size={13}/></button>{onDemand && medicine.quantity <= medicine.minimumStock && <button className="text-button" onClick={() => onDemand(medicine)} title="Demand list mein add karein"><ClipboardPlus size={14}/>Demand</button>}{onEdit && <button className="icon-button" aria-label={`Edit ${medicine.name}`} onClick={() => onEdit(medicine)}><SlidersHorizontal size={15}/></button>}{onDelete && <button className="delete-row-button" aria-label={`Delete ${medicine.name}`} disabled={deleteDisabled} onClick={() => onDelete(medicine)}><Trash2 size={14}/>Delete</button>}</div></td></tr>)}</tbody></table>{!medicines.length && <Empty icon={Package} title={loading ? 'Loading medicines…' : 'Nothing here yet'} text={emptyText}/>}</div>;
}
