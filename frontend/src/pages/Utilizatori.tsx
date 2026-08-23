/**
 * Pagina de sine statatoare „Utilizatori" (/utilizatori), deschisa din plăcuța
 * din meniu. Ruta e protejata in App.tsx (`canUsers()`), iar endpointurile
 * /api/users* cer `Resource.USERS` pe server.
 *
 * Continutul e acelasi panou care apare si in Configurări → Cont → Utilizatori;
 * il refolosim ca sa nu intretinem doua ecrane identice.
 */
import UtilizatoriPanel from "./configurari/UtilizatoriPanel";

export default function Utilizatori() {
  return (
    <div class="page-content" style="padding:16px">
      <div style="max-width:1400px;margin:0 auto">
        <UtilizatoriPanel />
      </div>
    </div>
  );
}
