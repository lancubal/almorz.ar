# Arquitectura de Despliegue en AWS — RootResumeOS

## Stack en producción

| Componente | Tecnología |
|---|---|
| Servidor | AWS EC2 (Ubuntu 22.04 LTS, `t3.small` / `t3.medium`) |
| Contenedores | Docker + Docker Compose instalados en la VM |
| Registro de imágenes | Amazon ECR (privado) |
| CI/CD | GitHub Actions |
| SSL | Let's Encrypt (Certbot), montado como volumen en Nginx |

---

## Servicios Docker Compose (`docker-compose.prod.yml`)

| Servicio | Imagen | Descripción |
|---|---|---|
| `proxy` | `nginx:1.25-alpine` | Reverse proxy, expone puertos `80` y `443` |
| `frontend` | `ECR/rootresume/frontend:latest` | App Next.js, red interna |
| `backend` | `ECR/rootresume/backend:latest` | API Node.js, red interna |

Todos los servicios se comunican a través de la red interna `portfolio-net` (bridge).
El único punto de entrada externo es Nginx.

---

## Flujo de tráfico

```
Browser
  └─► Nginx (contenedor, :80/:443)
        ├─► frontend (Next.js, red interna)
        └─► backend (Node.js API, red interna)
                └─► Docker containers efímeros (ejecución de código Python/C/Rust)
```

> El backend monta `/var/run/docker.sock` para poder crear contenedores efímeros de ejecución de código.

---

## Flujo CI/CD

```
push a master
  └─► GitHub Actions
        └─► docker build (frontend + backend)
              └─► docker push → Amazon ECR
                    └─► EC2: docker compose pull + up -d
```

### Comando de actualización en EC2

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

---

## Variables de entorno requeridas en EC2 (`.env`)

```env
ECR_REGISTRY=123456789012.dkr.ecr.us-east-1.amazonaws.com
RESEND_API_KEY=<tu-api-key>
```

---

## Notas importantes

- El **frontend corre en EC2** como contenedor Docker, **no en Vercel** (aunque PROJECT_SPEC_AWS.md lo mencionaba como opción original).
- SSL está gestionado con **Certbot/Let's Encrypt**, el certificado se monta como volumen read-only en el contenedor Nginx (`/etc/letsencrypt`).
- El EC2 necesita un **rol IAM** con `AmazonEC2ContainerRegistryReadOnly` para hacer pull de imágenes desde ECR sin credenciales hardcodeadas.
- El **Grupo de Seguridad** de EC2 debe tener abiertos los puertos: `22` (SSH, solo tu IP), `80` (HTTP) y `443` (HTTPS).

---

## Cómo extender la página

1. Hacer los cambios en `client/` (frontend) o `server/` (backend).
2. Push a `master` — GitHub Actions construye y sube las nuevas imágenes a ECR automáticamente.
3. Conectarse al EC2 por SSH y ejecutar:
   ```bash
   docker compose -f docker-compose.prod.yml pull
   docker compose -f docker-compose.prod.yml up -d
   ```
4. Si se agrega un nuevo servicio:
   - Declararlo en `docker-compose.prod.yml`.
   - Actualizar `nginx/nginx.conf` con la nueva ruta o upstream.
   - Crear su repositorio en ECR (`rootresume/<nombre-servicio>`).
