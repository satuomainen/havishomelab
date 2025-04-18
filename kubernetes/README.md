# Install and set up Kubernetes

The goal is to understand and observe in practice how a Kubernetes cluster works, and learn how to manage it.

## First steps

Install ubuntu servers, 3x (2vCPU, 4GB RAM, 64GB disk)
- `sudo apt install avahi-daemon`
- `nano /etc/systemd/resolved.conf`, set MulticastDNS=yes and LLMNR=no
- `sudo systemctl restart systemd-resolved.service`
- `sudo curl -fsSL https://get.docker.com | sh`, this is needed for k3s installation with docker as container engine
    - `sudo usermod -aG docker $USER`, this just makes it easier for a non-root user

Add static leases to DHCP on router for the VM MAC addresses. This will also make life easier.

Create a secret token, this is an example to tie the commands below together: SECRET=c84713aa226e11f099ae1ba5bfb39e8f.

On the controller node, install K3s with Docker as the container tech:
`curl -sfL https://get.k3s.io | K3S_TOKEN=c84713aa226e11f099ae1ba5bfb39e8f sh -s - server --cluster-init --docker`

On the controller node, edit `/etc/rancher/k3s/config.yaml`, here's safe baseline:

```yaml
write-kubeconfig-mode: "0644"
tls-san:
  # Your mDNS/Avahi name, replace this on every node with the correct value
  - k3s-controller.local
  # Hostname, replace this on every node with the correct value
  - k3s-controller
  # Local access
  - localhost
  # Static DHCP address for k3s-controller, replace this on every node with the correct value
  - 192.168.1.221
  # Local access via IP
  - 127.0.0.1
  - kubernetes
  - kubernetes.default
  - kubernetes.default.svc
  - kubernetes.default.svc.cluster.local
# The secret token given
token: c84713aa226e11f099ae1ba5bfb39e8f
```
Then restart K3s: `sudo systemctl daemon-reload && sudo systemctl restart k3s`

On the other nodes, install K3S and join the cluster:
`curl -sfL https://get.k3s.io | K3S_TOKEN=c84713aa226e11f099ae1ba5bfb39e8f sh -s - server --docker --server https://<ip for k3s-controller.local>:6443`

Repeat the configuration into `/etc/rancher/k3s/config.yaml`.

To get the cluster config for your local `~/.kube/config/`, say `kubectl config view --raw` and put that into the config file.

## Install mdns-kube

This service will broadcast all deployed k8s services by their name with mDNS. This helps to avoid setting up

See [./kubernetes/mdns-kube-deployment.yaml](./kubernetes/mdns-kube-deployment.yaml).

### Install mailpit to trap all emails from apps

See [./kubernetes/mailpit/mailpit.yaml](./kubernetes/mailpit/mailpit.yaml) and apply it.

### Install cert-manager to issue cluster internal certificates

**None of this is OK anywhere but in my homelab.** One goal of this is to gain better understanding how certificates
work overall and especially in a k8s cluster. This would not be how

#### Step 1. On one of the cluster nodes, create the secret containing the private and secret cert and key:

Before starting, use the cluster CA as the cert-manager CA. Run this on the k3s-controller node:

```bash
sudo cat /var/lib/rancher/k3s/server/tls/server-ca.crt > server-ca.crt
sudo cat /var/lib/rancher/k3s/server/tls/server-ca.key > server-ca.key
kubectl create namespace cert-manager
kubectl -n cert-manager create secret tls k3s-ca-key-pair --cert=server-ca.crt --key=server-ca.key
```

#### Step 2: Install cert-manager

See [cert-manager documentation](https://artifacthub.io/packages/helm/cert-manager/cert-manager).

TL;DR:
```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.17.2/cert-manager.crds.yaml
helm repo add jetstack https://charts.jetstack.io --force-update
helm install cert-manager --namespace cert-manager --version v1.17.2 jetstack/cert-manager
```

#### Step 3: Add the ClusterIssuer

See [./cluster-issuer-deployment.yaml](./cluster-issuer-deployment.yaml).

### Configure traefik to route SSH

Edit the Traefik deployment: `EDITOR=nano kubectl -n kube-system edit deployment traefik`

Look for section `spec.template.spec.containers.args`. Among the other lines that look like this, add ssh address:
```yaml
    - --entrypoints.ssh.address=:22
```

Finally, restart Traefik: `kubectl -n kube-system rollout restart deployment traefik`

## Install Gitea into the K3S cluster

Gitea does what GitHub does, including running workflow actions. It also provides a self-hosted Docker image
registry.

In the [gitea](./gitea) folder:
1. Create gitea namespace: `kubectl create namespace gitea`
2. Install Gitea TLS secret: `kubectl -n gitea apply -f gitea-tls-secret-deployment.yaml`
3. See [./gitea/gitea-values.yaml](./gitea/gitea-values.yaml) and do what it says there.

Now the repositories need to be added differently since the port is not the standard 22. There are two options:

### Option 1: Specify port in origin

`git remote add origin ssh://git@gitea.local:30022/<username>/<repository>.git`

### Option 2: Make special SSH config

Add gitea.local to `~/.ssh/config`:

```
Host gitea.local
  Hostname gitea.local
  Port 30022
  User git
  Identityfile ~/.ssh/id_ed25519
```

Use the correct identity file that you used when adding the key to the user.

### Prepare for Docker registry

Gitea has a Docker image registry built-in. You can push images there to deploy them somewhere:
```bash
# docker build
# docker tagging:
# - use external tag with gitea.local to be able to push and pull from outside cluster
# - and also cluster internal registry.gitea.svc.cluster.local to be able to push and pull inside the cluster

# From outside the cluster
docker push gitea.local/<username>/<repository>/demoapp

# From inside the cluster
docker push registry.gitea.svc.cluster.local/<username>/
```

### Install the Gitea Act Runner

Gitea Act Runner has been one of the most frustrating installations ever. After much struggle, I was finally
able to get a workflow to build a Docker image and push it to the Gitea's own registry. But only using native
docker build in the workflow. I tried really hard to be able to use the docker family of actions
(`docker/setup-docker-action`, `docker/login-action`, `docker/setup-buildx-action`) but it turned out to be
beyond my capabilities. A big part of the struggle was my own fault, wanting to run Gitea in Kubernetes,
refusing proper DNS and insisting on using self-signed certificates. I don't think the issues I experienced
would come up in a proper production environment, and they are anyway secondary to the main goal of learning
DevOps and Kubernetes. That's why this will do.

The runner installation goes as specified in
[./gitea/gitea-runner-deployment.yaml](./gitea/gitea-runner-deployment.yaml).

#### Failures with docker actions

Trying to use the docker actions went fine until `docker/build-push-action`. When it was time to push the
built and tagged image to the Gitea registry. Then this error is printed because the self-signed certificate
is not trusted:

```
ERROR: failed to solve: failed to push registry.gitea.svc.cluster.local/***/homelab/demoapp:snapshot: failed to
do request: Head "https://registry.gitea.svc.cluster.local/v2/***/homelab/demoapp/blobs/sha256:84475ef4edcea0f7
d1a965b3bc63d6fa781ffc2368b48e278d3b0c7fac021356": tls: failed to verify certificate: x509: certificate signed
by unknown authority
```
From what I was able to figure out, there are a couple of ways to go around this.

First way, which is used in the native docker build in the current workflows, is to use dirty tricks with
the `docker` command by using `--tlsverify=false`: `DOCKER_TLS_VERIFY=0 docker --tlsverify=false <the job to be done>`.
This seems to help Docker to get over all trust issues.

Another way is to add certificates and/or insecure registries in the runner deployment config in the
`gitea-act-runner-config` ConfigMap and mount them to the right places:
```yaml
  # This would be mounted as /etc/docker/daemon.json for the runner and daemon containers in gitea-act-runner-dind
  docker-daemon.json: |
    {
      "insecure-registries": [ "registry.gitea.svc.cluster.local:443" ]
    }
```
In a similar way, I experimented mounting the gitea-tls CA certificate as
`/etc/docker/certs.d/registry.gitea.svc.cluster.local/ca.crt` in the runner containers. That felt somehow even
dirtier than using the command line options to ignore TLS verification.

Again, getting all of this 100% right is not my goal right now. This will be good enough for a setup that
I can spin up to learn new stuff and shut down when I'm done. 
