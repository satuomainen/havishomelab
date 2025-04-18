# Figure out how certificate issuing goes

## Preconditions

Installing the echo service just verifies that the preconditions have been met:
- mdns-kube has been installed to K3S
- cert-manager, TLS secret and cluster issuer have been deployed

If after this `https://echo.local` provides a certificate that has `echo.local` in the cert SAN,
then everything is good to go.

## Prepare the environment

```bash
kubectl apply -f 01-echo-deployment.yaml
kubectl apply -f 02-echo-certificate.yaml
kubectl apply -f 03-echo-ingress.yaml
```

## Validation steps

```bash
# Confirm cert-manager issued the cert
kubectl get certificate echo-tls -n default
kubectl describe certificate echo-tls -n default

# Confirm secret created
kubectl get secret echo-tls -n default

# Confirm Ingress
kubectl get ingress echo-ingress -n default
```

## Test locally

Browse to [https://echo.local](https://echo.local)

Verify that the certificate is at least valid for the name

## Clean up

```bash
kubectl delete -f 03-echo-ingress.yaml
kubectl delete -f 02-echo-certificate.yaml
kubectl delete -f 01-echo-deployment.yaml
```