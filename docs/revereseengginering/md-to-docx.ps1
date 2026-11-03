param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

function Escape-Xml([string]$value) {
  if ($null -eq $value) { return '' }
  return [System.Security.SecurityElement]::Escape($value)
}

function New-Paragraph([string]$text, [string]$style = '') {
  $escaped = Escape-Xml $text
  $styleXml = ''
  if ($style) {
    $styleXml = "<w:pPr><w:pStyle w:val=`"$style`"/></w:pPr>"
  }
  return "<w:p>$styleXml<w:r><w:t xml:space=`"preserve`">$escaped</w:t></w:r></w:p>"
}

function New-Table([array]$rows) {
  $xml = '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tblBorders></w:tblPr>'
  foreach ($row in $rows) {
    $xml += '<w:tr>'
    foreach ($cell in $row) {
      $xml += '<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>'
      $xml += (New-Paragraph $cell)
      $xml += '</w:tc>'
    }
    $xml += '</w:tr>'
  }
  $xml += '</w:tbl>'
  return $xml
}

function Is-TableSeparator([string]$line) {
  return $line -match '^\s*\|?[\s:\-\|]+\|?\s*$' -and $line -match '-'
}

function Split-TableRow([string]$line) {
  $trimmed = $line.Trim()
  if ($trimmed.StartsWith('|')) { $trimmed = $trimmed.Substring(1) }
  if ($trimmed.EndsWith('|')) { $trimmed = $trimmed.Substring(0, $trimmed.Length - 1) }
  return $trimmed.Split('|') | ForEach-Object { $_.Trim() }
}

$source = Get-Content -Raw -LiteralPath $InputPath
$lines = $source -split "`r?`n"
$body = ''
$i = 0

while ($i -lt $lines.Count) {
  $line = $lines[$i]

  if ($line.Trim() -eq '') {
    $i += 1
    continue
  }

  if ($line.Trim().StartsWith('```')) {
    $i += 1
    while ($i -lt $lines.Count -and -not $lines[$i].Trim().StartsWith('```')) {
      $body += New-Paragraph $lines[$i] 'Code'
      $i += 1
    }
    $i += 1
    continue
  }

  if ($line -match '^\s*\|.*\|\s*$' -and ($i + 1) -lt $lines.Count -and (Is-TableSeparator $lines[$i + 1])) {
    $rows = New-Object System.Collections.ArrayList
    [void]$rows.Add((Split-TableRow $line))
    $i += 2
    while ($i -lt $lines.Count -and $lines[$i] -match '^\s*\|.*\|\s*$') {
      [void]$rows.Add((Split-TableRow $lines[$i]))
      $i += 1
    }
    $body += New-Table $rows
    continue
  }

  if ($line -match '^(#{1,6})\s+(.+)$') {
    $level = $Matches[1].Length
    $text = $Matches[2].Trim()
    $body += New-Paragraph $text "Heading$level"
    $i += 1
    continue
  }

  if ($line -match '^\s*[-*]\s+(.+)$') {
    $body += New-Paragraph ("- " + $Matches[1].Trim()) 'ListParagraph'
    $i += 1
    continue
  }

  if ($line -match '^\s*\d+\.\s+(.+)$') {
    $body += New-Paragraph $line.Trim() 'ListParagraph'
    $i += 1
    continue
  }

  if ($line -match '^\s*---+\s*$') {
    $i += 1
    continue
  }

  $body += New-Paragraph $line.Trim()
  $i += 1
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("md-docx-" + [guid]::NewGuid().ToString('N'))
$wordDir = Join-Path $tempRoot 'word'
$relsDir = Join-Path $tempRoot '_rels'
$wordRelsDir = Join-Path $wordDir '_rels'
$docPropsDir = Join-Path $tempRoot 'docProps'
New-Item -ItemType Directory -Force -Path $wordDir, $relsDir, $wordRelsDir, $docPropsDir | Out-Null

$contentTypes = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
'@

$rootRels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
'@

$docRels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
'@

$styles = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="360" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="300" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="240" w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading5"><w:name w:val="heading 5"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="21"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading6"><w:name w:val="heading 6"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="20"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="360"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="18"/></w:rPr></w:style>
  <w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/><w:qFormat/></w:style>
</w:styles>
'@

$document = "<?xml version=`"1.0`" encoding=`"UTF-8`" standalone=`"yes`"?><w:document xmlns:w=`"http://schemas.openxmlformats.org/wordprocessingml/2006/main`"><w:body>$body<w:sectPr><w:pgSz w:w=`"11906`" w:h=`"16838`"/><w:pgMar w:top=`"1440`" w:right=`"1440`" w:bottom=`"1440`" w:left=`"1440`" w:header=`"720`" w:footer=`"720`" w:gutter=`"0`"/></w:sectPr></w:body></w:document>"

$created = (Get-Date).ToUniversalTime().ToString('s') + 'Z'
$core = "<?xml version=`"1.0`" encoding=`"UTF-8`" standalone=`"yes`"?><cp:coreProperties xmlns:cp=`"http://schemas.openxmlformats.org/package/2006/metadata/core-properties`" xmlns:dc=`"http://purl.org/dc/elements/1.1/`" xmlns:dcterms=`"http://purl.org/dc/terms/`" xmlns:dcmitype=`"http://purl.org/dc/dcmitype/`" xmlns:xsi=`"http://www.w3.org/2001/XMLSchema-instance`"><dc:title>Software Implementation Forensics Document</dc:title><dc:creator>Codex</dc:creator><cp:lastModifiedBy>Codex</cp:lastModifiedBy><dcterms:created xsi:type=`"dcterms:W3CDTF`">$created</dcterms:created><dcterms:modified xsi:type=`"dcterms:W3CDTF`">$created</dcterms:modified></cp:coreProperties>"
$app = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Codex OpenXML Export</Application></Properties>'

Set-Content -LiteralPath (Join-Path $tempRoot '[Content_Types].xml') -Value $contentTypes -Encoding UTF8
Set-Content -LiteralPath (Join-Path $relsDir '.rels') -Value $rootRels -Encoding UTF8
Set-Content -LiteralPath (Join-Path $wordRelsDir 'document.xml.rels') -Value $docRels -Encoding UTF8
Set-Content -LiteralPath (Join-Path $wordDir 'styles.xml') -Value $styles -Encoding UTF8
Set-Content -LiteralPath (Join-Path $wordDir 'document.xml') -Value $document -Encoding UTF8
Set-Content -LiteralPath (Join-Path $docPropsDir 'core.xml') -Value $core -Encoding UTF8
Set-Content -LiteralPath (Join-Path $docPropsDir 'app.xml') -Value $app -Encoding UTF8

if (Test-Path -LiteralPath $OutputPath) {
  Remove-Item -LiteralPath $OutputPath -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($tempRoot, $OutputPath)
Remove-Item -LiteralPath $tempRoot -Recurse -Force

Write-Host "DOCX written to $OutputPath"
