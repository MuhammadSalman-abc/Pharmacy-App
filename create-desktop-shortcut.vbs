Option Explicit

Dim shell, fso, projectFolder, desktopPath, shortcut
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
projectFolder = fso.GetParentFolderName(WScript.ScriptFullName)
desktopPath = shell.SpecialFolders("Desktop")
Set shortcut = shell.CreateShortcut(desktopPath & "\MediStock Pharmacy.lnk")
shortcut.TargetPath = projectFolder & "\start-pharmacy.bat"
shortcut.WorkingDirectory = projectFolder
shortcut.Description = "Open MediStock Pharmacy desktop window"
shortcut.IconLocation = shell.ExpandEnvironmentStrings("%PROGRAMFILES(X86)%") & "\Microsoft\Edge\Application\msedge.exe,0"
shortcut.Save
MsgBox "MediStock Pharmacy shortcut desktop par ban gaya hai.", vbInformation, "MediStock Pharmacy"
