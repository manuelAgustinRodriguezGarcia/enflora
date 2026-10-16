function Chip({ children, tono = "verde" }) {
  return <span className={`producto-preview__chip producto-preview__chip--${tono}`}>{children}</span>;
}

function PreviewMisCultivos() {
  return (
    <div className="producto-preview__ui">
      <div className="producto-preview__ui-top">
        <strong>Mis cultivos</strong>
        <Chip tono="lima">Disponible</Chip>
      </div>
      <div className="producto-preview__ruta" aria-hidden="true">
        <span>Espacio</span>
        <span>→</span>
        <span>Unidad</span>
        <span>→</span>
        <span>Planta</span>
      </div>
      <div className="producto-preview__cards">
        <article className="producto-preview__card">
          <div className="producto-preview__card-head">
            <span>Interior · Carpa</span>
            <Chip tono="lima">6 plantas</Chip>
          </div>
          <strong>Carpa principal</strong>
          <p>Unidad A · Sustrato</p>
        </article>
      </div>
      <div className="producto-preview__ficha">
        <div className="producto-preview__avatar" aria-hidden="true" />
        <div>
          <strong>OG Kush #03</strong>
          <p>Genética OG Kush · Vegetativo · Día 28</p>
        </div>
      </div>
      <ul className="producto-preview__etapas">
        <li data-done>Germinación</li>
        <li data-done>Plántula</li>
        <li data-active>Vegetativo</li>
        <li data-next>Enflora</li>
      </ul>
    </div>
  );
}

function PreviewMiSeguimiento() {
  return (
    <div className="producto-preview__ui">
      <div className="producto-preview__ui-top">
        <strong>Nuevo registro</strong>
        <Chip>Plantas</Chip>
      </div>
      <div className="producto-preview__tabs">
        <span data-active>Plantas</span>
        <span>Ambiente</span>
      </div>
      <div className="producto-preview__form">
        <label>
          Acción
          <span>Riego</span>
        </label>
        <label>
          Medición
          <span>pH · ejemplo de demo</span>
        </label>
      </div>
      <div className="producto-preview__seguimiento-extra">
        <div className="producto-preview__modo-mini" data-active>
          Profesional
        </div>
        <div className="producto-preview__foto-mini" aria-hidden="true">
          <span />
          <em>Foto · Próximamente</em>
        </div>
      </div>
      <p className="producto-preview__nota">Ambiente: temperatura, humedad y VPD por unidad.</p>
    </div>
  );
}

function PreviewOrigenHistoria() {
  return (
    <div className="producto-preview__ui producto-preview__ui--adn">
      <div className="producto-preview__ui-top">
        <strong>Origen e historia</strong>
        <Chip tono="arena">Próximamente</Chip>
      </div>
      <p className="producto-preview__nota">
        Parentesco registrado por esquejes. No es secuenciación genética de laboratorio.
      </p>
      <div className="producto-preview__arbol" aria-hidden="true">
        <div className="producto-preview__nodo producto-preview__nodo--madre">Blue Dream #01</div>
        <div className="producto-preview__ramas">
          <div className="producto-preview__nodo">Esqueje A</div>
          <div className="producto-preview__nodo">Esqueje B</div>
        </div>
        <div className="producto-preview__ramas">
          <div className="producto-preview__nodo producto-preview__nodo--hijo">Planta #07</div>
        </div>
      </div>
      <div className="producto-preview__timeline">
        <div>
          <em>21 SEP</em>
          <span>Riego + medición</span>
        </div>
        <div>
          <em>18 SEP</em>
          <span>Cambio a Enflora</span>
        </div>
      </div>
    </div>
  );
}

const PREVIEWS = {
  "mis-cultivos": PreviewMisCultivos,
  "mi-seguimiento": PreviewMiSeguimiento,
  "origen-e-historia": PreviewOrigenHistoria,
};

export function VistaPreviaFuncionalidad({ preview, titulo }) {
  const Vista = PREVIEWS[preview] || PreviewMisCultivos;
  return (
    <div className="producto-preview" aria-label={`Vista previa: ${titulo}`}>
      <Vista />
    </div>
  );
}
