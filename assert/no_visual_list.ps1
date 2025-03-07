Get-ChildItem -Path . -Recurse -Filter *config.json -File |
    Where-Object {
        (Select-String -Path $_.FullName -Pattern 'visual').Count -lt 9
    } |
    Select-Object -ExpandProperty FullName -First 5