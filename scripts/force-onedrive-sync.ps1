# Force OneDrive to re-download BinsRecieving.xlsx
# Run this before the sync script to ensure fresh data
# Works by opening the file via COM (triggers OneDrive hydration), then closing it

$file = 'C:\Users\rickus.MOUTONSVALLEY\OneDrive - Moutons Valley Trust\Attachments\BinsRecieving.xlsx'

if (-not (Test-Path $file)) {
    Write-Host "File not found: $file"
    exit 1
}

try {
    # Open in Excel (headless), which forces OneDrive to fetch the latest version
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $wb = $excel.Workbooks.Open($file, 0, $true)  # ReadOnly=true
    Start-Sleep -Seconds 5
    $wb.Close($false)
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') OneDrive sync forced for BinsRecieving.xlsx"
} catch {
    Write-Host "Error: $_"
    # Make sure Excel is cleaned up
    try { $excel.Quit() } catch {}
}
