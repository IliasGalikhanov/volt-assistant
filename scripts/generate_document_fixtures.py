"""Generate original, explicitly synthetic document fixtures with no supplier data."""
from pathlib import Path
import json
import zipfile
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
dest = ROOT / "evaluation/documents"
dest.mkdir(parents=True, exist_ok=True)
rows = [{"query": "DEMO-MCB-002", "quantity": 3}, {"query": "DEMO-CBL-002", "quantity": 10}]
(dest/"semicolon.csv").write_text("артикул;quantity\nDEMO-MCB-002;3\nDEMO-CBL-002;10\n",encoding="utf-8")
(dest/"invalid-quantity.csv").write_text("sku,quantity\nDEMO-MCB-002,-3\n",encoding="utf-8")
(dest/"rows.json").write_text(json.dumps(rows,indent=2)+"\n",encoding="utf-8")
def package(name, files):
    with zipfile.ZipFile(dest/name,"w",zipfile.ZIP_DEFLATED) as z:
        for key, value in files.items(): z.writestr(key,value)
table = [["SYNTHETIC fixture","quantity"],["DEMO-MCB-002","3"],["DEMO-CBL-002","10"]]
doc_rows = "".join("<w:tr>"+ "".join("<w:tc><w:p><w:r><w:t>"+escape(c)+"</w:t></w:r></w:p></w:tc>" for c in row)+"</w:tr>" for row in table)
package("table.docx",{
 "[Content_Types].xml":'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
 "_rels/.rels":'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
 "word/document.xml":'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl>'+doc_rows+'</w:tbl></w:body></w:document>'})
sheet = "".join('<row r="'+str(i+1)+'">'+ "".join('<c r="'+chr(65+j)+str(i+1)+'" t="inlineStr"><is><t>'+escape(c)+'</t></is></c>' for j,c in enumerate(row))+'</row>' for i,row in enumerate([["sku","quantity"],*table[1:]]))
package("table.xlsx",{
 "[Content_Types].xml":'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
 "_rels/.rels":'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
 "xl/workbook.xml":'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Synthetic" sheetId="1" r:id="rId1"/></sheets></workbook>',
 "xl/_rels/workbook.xml.rels":'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
 "xl/worksheets/sheet1.xml":'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+sheet+'</sheetData></worksheet>'})
stream=b"BT /F1 16 Tf 50 780 Td (SYNTHETIC EVALUATION FIXTURE) Tj 0 -40 Td (DEMO-MCB-002   3) Tj 0 -30 Td (DEMO-CBL-002   10) Tj ET"
objects=[b"<< /Type /Catalog /Pages 2 0 R >>",b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",b"<< /Length "+str(len(stream)).encode()+b" >>\nstream\n"+stream+b"\nendstream"]
data=b"%PDF-1.4\n"; offsets=[0]
for i,obj in enumerate(objects,1):
    offsets.append(len(data));data+=str(i).encode()+b" 0 obj\n"+obj+b"\nendobj\n"
xref=len(data);data+=b"xref\n0 6\n0000000000 65535 f \n"
for offset in offsets[1:]:data+=f"{offset:010} 00000 n \n".encode()
data+=b"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n"+str(xref).encode()+b"\n%%EOF\n"
(dest/"text.pdf").write_bytes(data)
manifest=[{"file":name,"rows":rows,"expected_status":"review","mode":"off"} for name in ["semicolon.csv","rows.json","table.docx","table.xlsx","text.pdf"]]
manifest.append({"file":"invalid-quantity.csv","rows":[],"expected_status":"failed","mode":"off"})
for name in ["clean.png","rotated.png","low-contrast.png","untrusted-note.png"]:
    manifest.append({"file":name,"rows":rows,"expected_status":"review","mode":"model"})
(dest/"manifest.json").write_text(json.dumps({"synthetic":True,"cases":manifest},indent=2)+"\n",encoding="utf-8")
print("Generated six structured fixtures and image manifest.")

