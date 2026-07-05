# Deployment

Production is `https://gamehubparty.ru` on server `201.51.12.133`.

The frontend is built locally and uploaded to:

```text
/home/deploy/apps/gamehubparty/current
```

Each deployment is stored as a separate release. The five newest releases are
kept so switching back is possible.

## One-time SSH access setup

The working deployment key in this workspace is:

```text
.deploy-keys/gamehubparty_deploy
```

`deploy.ps1` already prefers that key. It falls back to `%USERPROFILE%/.ssh/gamehubparty_deploy`, then to the newer `gamehubparty_deploy_20260619` variants if needed.

The optional home-directory deployment key is:

```text
%USERPROFILE%/.ssh/gamehubparty_deploy
```

Prepare its secured local copy:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-local-key.ps1
```

Add the contents of `.deploy-keys/gamehubparty_deploy.pub` to this file on the server:

```text
/home/deploy/.ssh/authorized_keys
```

The easiest option is to enter the `deploy` password once:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-ssh-key.ps1
```

Using the hosting console or an existing privileged session:

```bash
sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
echo 'PASTE_PUBLIC_KEY_HERE' | sudo tee -a /home/deploy/.ssh/authorized_keys
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

Then verify access:

```powershell
powershell -ExecutionPolicy Bypass -File .\test-ssh.ps1
```

## Deploy

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -KeyPath ".deploy-keys\gamehubparty_deploy"
```

This command runs the production build and test suite before uploading.

The web server should serve `/home/deploy/apps/gamehubparty/current`. For an
SPA, configure unknown routes to fall back to `index.html`.

## One-time nginx and HTTPS setup

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-server.ps1
```

This connects nginx to the deployed frontend and configures HTTPS using
Certbot. Enter the `deploy` sudo password when prompted.
