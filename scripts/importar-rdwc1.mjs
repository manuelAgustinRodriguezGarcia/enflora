import { cargarEnvLocal } from "@/lib/import/cargar-env-local.js";
import { IMPORT_ID } from "@/lib/import/rdwc1-constantes.js";
import {
  ejecutarDryRun,
  ejecutarImport,
  ejecutarRollback,
  ejecutarVerify,
} from "@/lib/import/rdwc1-ejecutor.js";
import { imprimirResultado } from "@/lib/import/rdwc1-salida.js";
import { credencialesDisponibles } from "@/lib/import/rdwc1-validacion.js";

cargarEnvLocal();

const argv = process.argv.slice(2);
const args = new Set(argv);
const conSesion = args.has("--con-sesion");
const salidaJson = args.has("--json");
const verbose = args.has("--verbose");

function dryRunExitoso(resultado) {
  if (!resultado.validacion?.ok || resultado.plan?.error) return false;
  if ((resultado.conflictos?.length || 0) > 0) return false;
  if (resultado.infraestructura?.registro_fotos?.ok === false) return false;
  if (resultado.infraestructura?.bucket_fotos?.ok === false) return false;
  if (resultado.sesion?.error) return false;
  return true;
}

async function main() {
  if (args.has("--dry-run")) {
    const resultado = await ejecutarDryRun({ conSesion, env: process.env });
    imprimirResultado(resultado, { json: salidaJson, verbose });
    process.exit(dryRunExitoso(resultado) ? 0 : 1);
  }

  if (args.has("--verify")) {
    if (!credencialesDisponibles()) {
      console.error("Faltan credenciales ENFLORA_IMPORT_* y Supabase en el entorno.");
      process.exit(1);
    }
    const resultado = await ejecutarVerify({ env: process.env });
    console.log(JSON.stringify(resultado, null, 2));
    process.exit(resultado.ok ? 0 : 1);
  }

  if (args.has("--rollback")) {
    if (!credencialesDisponibles()) {
      console.error("Faltan credenciales ENFLORA_IMPORT_* y Supabase en el entorno.");
      process.exit(1);
    }
    const resultado = await ejecutarRollback({ env: process.env });
    console.log(JSON.stringify(resultado, null, 2));
    process.exit(resultado.ok ? 0 : 1);
  }

  if (args.has("--import")) {
    if (!credencialesDisponibles()) {
      console.error("Faltan credenciales ENFLORA_IMPORT_* y Supabase en el entorno.");
      process.exit(1);
    }
    const resultado = await ejecutarImport({ env: process.env });
    console.log(JSON.stringify(resultado, null, 2));
    process.exit(resultado.ok ? 0 : 1);
  }

  console.log(`Uso:
  pnpm import:rdwc1 -- --dry-run [--con-sesion] [--json|--verbose]
  pnpm import:rdwc1 -- --import   (requiere ENFLORA_IMPORT_CONFIRM=${IMPORT_ID})
  pnpm import:rdwc1 -- --verify
  pnpm import:rdwc1 -- --rollback (requiere ENFLORA_IMPORT_CONFIRM=${IMPORT_ID})

Variables:
  NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
  ENFLORA_IMPORT_EMAIL, ENFLORA_IMPORT_PASSWORD
  ENFLORA_IMPORT_CONFIRM=${IMPORT_ID}  (solo --import y --rollback)
`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
