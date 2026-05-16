/** Panou de bun-venit afisat cand nu e selectat niciun topic in pagina Configurari. */
export default function WelcomePanel() {
  return (
    <div class="cfg-welcome">
      <h2 class="cfg-welcome-title">Configurări sistem</h2>
      <p class="cfg-welcome-text">
        Această secțiune îți permite să configurezi elementele de bază ale aplicației.
        Selectează un topic din meniul din stânga pentru a începe.
      </p>
      <div class="cfg-welcome-items">
        <div class="cfg-welcome-item">
          <span class="cfg-welcome-item-title">Locații</span>
          <span class="cfg-welcome-item-desc">
            Gestionează locațiile fizice ale afacerii. Fiecare locație poate fi asociată cu departamente și angajați specifici, și va fi legată de dispozitivele înregistrate.
          </span>
        </div>
        <div class="cfg-welcome-item">
          <span class="cfg-welcome-item-title">Departamente</span>
          <span class="cfg-welcome-item-desc">
            Organizează produsele și serviciile pe departamente. Departamentele pot fi alocate locațiilor și sunt folosite pentru filtrarea catalogului în POS.
          </span>
        </div>
        <div class="cfg-welcome-item">
          <span class="cfg-welcome-item-title">Angajați</span>
          <span class="cfg-welcome-item-desc">
            Gestionează angajații: adaugă, modifică sau șterge angajați și setează targetul lunar al fiecăruia.
          </span>
        </div>
        <div class="cfg-welcome-item">
          <span class="cfg-welcome-item-title">Produse și Servicii</span>
          <span class="cfg-welcome-item-desc">
            Gestionează categoriile, produsele și serviciile din catalog. Filtrează după departament, categorie sau tip.
          </span>
        </div>
        <div class="cfg-welcome-item">
          <span class="cfg-welcome-item-title">Companii</span>
          <span class="cfg-welcome-item-desc">
            Gestionează companiile partenere sau furnizori. Caută automat datele firmei după CUI prin serviciul ANAF.
          </span>
        </div>
        <div class="cfg-welcome-item">
          <span class="cfg-welcome-item-title">Disclaimers</span>
          <span class="cfg-welcome-item-desc">
            Gestionează disclaimerele afișate pe bonuri sau documente. Adaugă, modifică sau șterge disclaimerele.
          </span>
        </div>
        <div class="cfg-welcome-item">
          <span class="cfg-welcome-item-title">Registre</span>
          <span class="cfg-welcome-item-desc">
            Gestionează seriile și numerele curente pentru Devize, Facturi, Chitanțe și Avize de însoțire a mărfii.
          </span>
        </div>
      </div>
    </div>
  );
}
