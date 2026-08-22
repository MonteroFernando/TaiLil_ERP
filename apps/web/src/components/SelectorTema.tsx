"use client";

export default function SelectorTema({
  mostrarTexto = true,
  clase = "",
}: {
  mostrarTexto?: boolean;
  clase?: string;
}) {
  function alternarTema() {
    const raiz = document.documentElement;
    const temaNuevo = raiz.dataset.tema === "oscuro" ? "claro" : "oscuro";
    raiz.dataset.tema = temaNuevo;
    window.localStorage.setItem("morita.tema", temaNuevo);
  }

  return (
    <button
      type="button"
      className={`selector-tema ${clase}`}
      onClick={alternarTema}
      aria-label="Cambiar entre modo claro y oscuro"
      title={!mostrarTexto ? "Cambiar tema" : undefined}
    >
      <span className="tema-alternar-claro selector-tema-icono" aria-hidden="true"><IconoLuna /></span>
      <span className="tema-alternar-oscuro selector-tema-icono" aria-hidden="true"><IconoSol /></span>
      {mostrarTexto && <><b className="tema-alternar-claro">Modo oscuro</b><b className="tema-alternar-oscuro">Modo claro</b></>}
    </button>
  );
}

function IconoLuna() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.2 15.7A8.5 8.5 0 0 1 8.3 3.8 8.5 8.5 0 1 0 20.2 15.7Z" />
    </svg>
  );
}

function IconoSol() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
