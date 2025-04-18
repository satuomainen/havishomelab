# ArgoCD Installation

ArgoCD provides a [Getting Started Guide}(https://argo-cd.readthedocs.io/en/stable/getting_started/).

TL;DR:
```yaml
# Create the namespace
kubectl create namespace argocd

# In the argocd directory, run:
kubectl -n argocd apply -k .

# Fix config by hand because I don't know how to do it via kustomization.yaml
EDITOR=nano kubectl edit deployment argocd-server -n argocd
# Find this:
#       containers:
#       - args:
#         - /usr/local/bin/argocd-server
# And make it read like this to turn off TLS: 
#       containers:
#       - args:
#         - /usr/local/bin/argocd-server
#         - --insecure
# Then restart the pod:
kubectl -n argocd rollout restart deployment argocd-server

# Create the ingress:
kubectl -n argocd apply -f ingress-for-argocd-server.yaml 
```

If everything went well, the ArgoCD web UI should respond: [https://argocd.local/](https://argocd.local/). It's
"unsecure" of course, you can export the certificate and import it to the browser to make it nicer.

The username is `admin` and the initial password can be obtained via
`kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d`.

