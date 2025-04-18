# Homelab setup for learning DevOps and GitOps

DevOps and GitOps are topics that come up in customer assignments fairly often. Event though coding is my passion,
I feel it's important to know DevOps and GitOps to be able to be effective in customer projects.

The purpose of this whole repository is to learn about those concepts through concrete activities and not just
reading about them. And I want to do this without any external resources (cloud) and minimal impact to my home
network. That means avoiding setting up a DNS, making changes to my router configuration, and doing minimal to
none configuration to the client machines (=my laptop). I want to be able shut down the homelab server during
the work week when I have no time to use it and only power it up during weekends and holidays. If there were
critical services running there, this would not be possible. These goals add some unnecessary complexity to the
whole process but I want to take the challenges as learning opportunities.

My strategy is to learn from the ground up, starting from setting up a computer to host a virtualization server
([Proxmox](https://www.proxmox.com/en/)) that shares the computer's resources to whatever they are needed.
Kubernetes comes up quite often, so I set up a Kubernetes cluster ([K3s](https://k3s.io/)) where "everything"
will run.


## The homelab hardware

* Lenovo ThinkCentre M720q Tiny (from ca. 2019)
* Intel(R) Core(TM) i5-8400T CPU @ 1.70GHz (6 cores)
* 32 GB RAM
* 256GB SSD (SATA)
* 1TB NVMe SSD

## Virtualization

Proxmox VE 8. Just follow the installation instructions on the Proxmox site.

## Kubernetes

See the kubernetes folder [README.md](./kubernetes/README.md). 

## A panic of kludges

Since the certificates on the cluster are all self-signed, some kludges on the client machine (=my laptop)
needs to be tolerated. This is the shameful list of them that probably keeps growing.  

### Make the browser trust the self-signed certificate for gitea.local

When browsing to `https://gitea.local`, there are different type of annoyances depending on what
browser is used. Those can be circumvented by saving the certificate provided by the site and
importing it in the browser's certificate store.

### Make client machine docker to trust the self-signed certificate for gitea.local

On the client machine, copy the Gitea ca.crt from gitea.local to the client machine as
`/etc/docker/certs.d/gitea.local/ca.crt`. 

The certificate can be found from the cluster's secrets:
`kubectl -n gitea get secret gitea-tls -o jsonpath='{.data.ca\.crt}'|base64 -d` 

After restarting docker: `systemctl restart docker`, you should be able to interact with
gitea.local using the `docker` command. 
