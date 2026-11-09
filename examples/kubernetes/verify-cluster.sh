#!/usr/bin/env bash
set -euo pipefail
# Use only the disposable context created by this example.
[[ "$(kubectl config current-context)" == "kind-kb-example" ]] || { echo 'Expected disposable kind-kb-example context'; exit 1; }
check_version() {
  local expected="$1"
  kubectl port-forward service/demo-api 18080:80 > /tmp/kb-port-forward.log 2>&1 &
  local forward_pid=$!
  local body
  if ! body=$(curl -fsS --retry 20 --retry-connrefused --retry-delay 1 --max-time 2 http://127.0.0.1:18080/version); then
    kill "$forward_pid" 2>/dev/null || true
    return 1
  fi
  kill "$forward_pid" 2>/dev/null || true
  node -e 'const r=JSON.parse(process.argv[1]);if(r.version!==process.argv[2])throw new Error("Wrong version");' "$body" "$expected"
}
kubectl apply -f examples/kubernetes/manifests.yaml
kubectl rollout status deployment/demo-api --timeout=120s
check_version v1
kubectl set env deployment/demo-api APP_VERSION=v2
kubectl rollout status deployment/demo-api --timeout=120s
check_version v2
# A new revision whose readiness never succeeds must not replace the ready revision.
kubectl patch deployment demo-api --type=json -p='[{"op":"replace","path":"/spec/template/spec/containers/0/readinessProbe/httpGet/path","value":"/never-ready"}]'
if kubectl rollout status deployment/demo-api --timeout=20s; then
  echo 'Expected the bad readiness revision to fail rollout completion'
  exit 1
fi
kubectl get endpointslices -l kubernetes.io/service-name=demo-api -o json | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{const slices=JSON.parse(s).items;const ready=slices.flatMap(s=>s.endpoints).filter(e=>e.conditions.ready===true);if(ready.length!==2)throw new Error("Expected two ready service endpoints during failed rollout");});'
check_version v2
kubectl rollout undo deployment/demo-api
kubectl rollout status deployment/demo-api --timeout=120s
check_version v2
kubectl get deployment demo-api -o json | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{const d=JSON.parse(s);if(d.status.readyReplicas!==2||d.status.updatedReplicas!==2)throw new Error("Expected restored two-replica revision");});'
echo 'PASS: initial readiness, v2 rollout, blocked bad revision, retained service and rollback'
