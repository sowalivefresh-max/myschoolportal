$dashboards = @('HeadTeacherDashboard.html','ParentDashboard.html','PrimaryTeacherDashboard.html','PrincipalDashboard.html','TeacherDashboard.html','VPDashboard.html','AccountsDashboard.html')

$cssLinks = @"
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
  <link rel="stylesheet" href="styles.css">
</head>
"@

$scriptLinks = '<script src="api.js"></script>' + "`n  " + '<script src="scripts.js"></script>'

foreach ($file in $dashboards) {
    if (!(Test-Path $file)) { Write-Host "SKIP: $file not found"; continue }
    $content = Get-Content $file -Raw -Encoding UTF8

    # Replace head with Styles include
    $content = $content -replace '(?s)<head>.*?<\?!=\s*include\(''Styles''\)\s*\?>.*?</head>', $cssLinks

    # Replace Scripts include tag
    $content = $content -replace "<\?!=\s*include\(\'Scripts\'\)\s*\?>", $scriptLinks

    # Replace AA.init with template vars (various patterns)
    $content = $content -replace 'AA\.init\([^)]*sessionToken[^)]*\)', 'AA.init()'

    Set-Content $file -Value $content -Encoding UTF8 -NoNewline
    Write-Host "FIXED: $file"
}
Write-Host "All done!"
