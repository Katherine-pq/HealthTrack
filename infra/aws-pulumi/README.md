# HealthTrack en AWS con Pulumi

Infraestructura productiva en `us-east-1`:

- CloudFront HTTPS, AWS WAF y origen VPC privado.
- Application Load Balancer interno.
- ECS Fargate con dos tareas, rollback automático y autoescalado hasta cuatro.
- ECR inmutable, cifrado y con escaneo al publicar.
- RDS PostgreSQL 18.6 Multi-AZ, privado, cifrado y con credencial administrada por Secrets Manager. La plantilla conserva siete días de backups; el stack actual usa un día, máximo admitido por la modalidad vigente de la cuenta AWS.
- KMS con rotación, CloudWatch, SNS, presupuesto y CloudTrail multi-región.

## Ejecución protegida

El wrapper carga `.env.aws` solo en su proceso, no imprime las claves, genera un bundle a partir del almacén confiable de Windows y restaura el entorno al finalizar.

```powershell
./scripts/Invoke-AwsEnvironment.ps1 -Tool pulumi -Initialize -Arguments @('preview','--non-interactive')
./scripts/Invoke-AwsEnvironment.ps1 -Tool pulumi -Arguments @('up','--yes','--non-interactive')
```

El estado queda en `.pulumi/state` y su frase se protege con DPAPI. Ambos están excluidos de Git. Respaldar el checkout protegido antes de operar la infraestructura desde otra máquina o identidad Windows.

Para una nueva imagen:

```powershell
./scripts/Invoke-AwsEnvironment.ps1 -Tool pulumi -RefreshImageTag -Arguments @('preview','--non-interactive')
./scripts/Invoke-AwsEnvironment.ps1 -Tool pulumi -Arguments @('up','--yes','--non-interactive')
```

No usar `pulumi destroy` sin plan de retiro: RDS y el ALB tienen protección de borrado, ECR conserva imágenes y CloudTrail conserva auditoría.
