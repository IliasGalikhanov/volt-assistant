"""Exercise upload -> durable worker -> human review on synthetic fixtures."""
import argparse
import datetime
import http.cookiejar
import json
from pathlib import Path
import subprocess
import time
import urllib.request
import uuid

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument("--base-url", default="http://127.0.0.1:8080")
parser.add_argument("--ollama-url", default="http://127.0.0.1:11434")
parser.add_argument("--strict", action="store_true", help="Fail if any expected result differs (used for deterministic CI fixtures)")
parser.add_argument("--modes", nargs="+", default=["off","primary","fallback"])
args = parser.parse_args()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def api(path, data=None, method=None, content_type="application/json"):
    if isinstance(data, dict): data=json.dumps(data).encode()
    request=urllib.request.Request(args.base_url+"/api"+path,data=data,method=method,
        headers={"Content-Type":content_type,"X-Volt-Request":"1"})
    with client.open(request,timeout=20) as response: return json.load(response)
def direct(path, body=None):
    request=urllib.request.Request(args.ollama_url+path,data=None if body is None else json.dumps(body).encode(),headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(request,timeout=240) as response:return json.load(response)
api("/datasets")
before=api("/cart")
manifest=json.loads((root/"evaluation/documents/manifest.json").read_text())["cases"]
report={"synthetic":True,"started_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "commit":subprocess.check_output(["git","rev-parse","HEAD"],cwd=root,text=True).strip(),"records":[]}
out=root/"evaluation/results/documents.json";out.parent.mkdir(parents=True,exist_ok=True)
def checkpoint():out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
for mode in args.modes:
    if mode!="off":
        config=api("/model");model=config["primary" if mode=="primary" else "fallback"]
        for loaded in direct("/api/ps").get("models",[]):direct("/api/generate",{"model":loaded["name"],"keep_alive":0})
        direct("/api/chat",{"model":model,"messages":[{"role":"user","content":"Return JSON: {\"ready\":true}"}],"stream":False,"think":False,"format":"json",
                           "options":{"num_gpu":0,"num_ctx":4096,"num_predict":32,"temperature":0},"keep_alive":"30m"})
    for case in manifest:
        if (case["mode"]=="off") != (mode=="off"):continue
        boundary="volt-"+uuid.uuid4().hex
        data=bytearray()
        for key,value in {"kind":"specification","model_mode":mode}.items():
            data.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
        data.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{case["file"]}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode())
        data.extend((root/"evaluation/documents"/case["file"]).read_bytes());data.extend(f"\r\n--{boundary}--\r\n".encode())
        started=time.monotonic()
        job=api("/uploads",bytes(data),content_type="multipart/form-data; boundary="+boundary)
        status=None
        while time.monotonic()-started<170:
            status=next((j for j in api("/jobs") if j["id"]==job["id"]),None)
            if status and status["status"] in ["review","failed"]:break
            time.sleep(.5)
        actual_rows=(status or {}).get("result",{}).get("rows",[])
        expected={(r["query"],r["quantity"]) for r in case["rows"]}
        actual={(r["query"],r["quantity"]) for r in actual_rows}
        good_status=(status or {}).get("status")==case["expected_status"]
        exact=good_status and actual==expected and len(actual_rows)==len(case["rows"])
        record={"file":case["file"],"mode":mode,"expected_status":case["expected_status"],"actual_status":(status or {}).get("status"),
                "expected_rows":case["rows"],"actual_rows":actual_rows,"exact_match":exact,"seconds":round(time.monotonic()-started,3),
                "row_precision":len(actual & expected)/len(actual) if actual else (1 if not expected else 0),
                "row_recall":len(actual & expected)/len(expected) if expected else (1 if not actual else 0),
                "error_code":(status or {}).get("error_code")}
        report["records"].append(record);checkpoint();print(mode,case["file"],exact,record["seconds"],flush=True)
        if status and status["status"] in ["review","failed"]:api("/jobs/"+job["id"],method="DELETE")
report["cart_unchanged"]=api("/cart")==before
report["finished_at"]=datetime.datetime.now(datetime.timezone.utc).isoformat()
checkpoint()
print("Saved",out)


if not report["cart_unchanged"] or (args.strict and not all(r["exact_match"] for r in report["records"])):
    raise SystemExit("Document evaluation failed; see saved results")
