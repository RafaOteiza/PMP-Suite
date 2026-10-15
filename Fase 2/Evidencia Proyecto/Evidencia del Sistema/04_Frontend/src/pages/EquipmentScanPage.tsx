import {localReport} from '../utils/pageReports';
import {scannerProof,type ScannerProof} from '../utils/receiptScanner';
import {formatOperationalStatus} from '../utils/formatters';
import {useNavigate} from 'react-router-dom';
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useOutletContext } from "react-router-dom";
import {
  AlertTriangle,
  Barcode,
  CheckCircle2,
  ClipboardList,
  Clock3,
  MapPin,
  ScanBarcode
} from "lucide-react";
import type { Me } from "../api/me";
import {
  resolveEquipmentScan,
  type ScanResolution,
  type ScanStation
} from "../api/equipmentScan";
import { getApiErrorMessage } from "../api/errors";
import { can, PERMISSIONS, ROLES } from "../app/rbac";
import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/ui/StatusBadge";
import FeedbackBanner from "../components/ui/FeedbackBanner";
import { formatDate } from "../utils/formatters";

const ROLE_STATION: Partial<Record<string, ScanStation>> = {
  [ROLES.JEFE_LABORATORIO]: "LABORATORIO",
  [ROLES.LOGISTICA]: "BODEGA",
  [ROLES.QA]: "QA"
};

const STATION_LABEL: Record<ScanStation, string> = {
  BODEGA: "Bodega",
  LABORATORIO: "Laboratorio",
  QA: "Certificación QA"
};

function ResultPanel({ result }: { result: ScanResolution }) {
  const successful = result.validacion.estado === "LISTO";
  return (
    <section className="panel scan-result" data-status={successful ? "success" : "warning"} aria-labelledby="scan-result-title">
      <header className="scan-result-header">
        <div className="scan-result-heading">
          {successful ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
          <div>
            <h2 id="scan-result-title">Equipo identificado · sin movimiento</h2>
            <p>{result.validacion.mensaje}</p>
          </div>
        </div>
        <StatusBadge health={successful ? "success" : "warning"}>{result.validacion.puede_confirmar?'Identidad consistente':'Revisar lectura'}</StatusBadge>
      </header>

      <dl className="scan-details">
        <div><dt>Tipo de equipo</dt><dd>{result.equipo.tipo_equipo}</dd></div>
        <div><dt>Serie</dt><dd className="numeric-value">{result.equipo.serie}</dd></div>
        <div><dt>Modelo / Marca</dt><dd>{result.equipo.modelo||"Sin registro"} · {result.equipo.marca||"Sin registro"}</dd></div><div><dt>AMID</dt><dd className="numeric-value">{result.equipo.amid || "No aplica"}</dd></div>
        <div><dt>Identificado por</dt><dd>{result.lectura.tipo_codigo}</dd></div>
        <div><dt>Orden activa</dt><dd>{result.orden?.codigo_os || "Sin OS activa"}</dd></div>
        <div><dt>Estado operacional</dt><dd>{formatOperationalStatus(result.orden?.estado,"Sin estado")}</dd></div>
        <div><dt>Ubicación confirmada</dt><dd>{result.orden?.ubicacion||"Consultar historial"}</dd></div>
        <div><dt>Última lectura anterior</dt><dd>{result.ultima_ubicacion ? `${result.ultima_ubicacion.ubicacion} · ${formatDate(result.ultima_ubicacion.fecha)}` : "Sin lecturas previas"}</dd></div>
      </dl>

      {result.orden ? (
        <div className="scan-order-context">
          <ClipboardList size={18} />
          <div><strong>{result.orden.codigo_os}</strong><span>{result.orden.falla} · Bus {result.orden.bus_ppu}</span></div>
        </div>
      ) : null}
    </section>
  );
}

export default function EquipmentScanPage() {
  const me = useOutletContext<Me | null>();
  const fixedStation = me?.rol ? ROLE_STATION[me.rol] : undefined;
  const [station, setStation] = useState<ScanStation>(fixedStation || "BODEGA");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ScanResolution | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate=useNavigate();
  const scanBuffer=useRef({code:'',times:[] as number[],proof:undefined as ScannerProof|undefined});
  const inputRef = useRef<HTMLInputElement>(null);
  const canWrite = can(me, PERMISSIONS.EQUIPMENT_SCAN_WRITE);
  const stationDescription = useMemo(() => STATION_LABEL[station], [station]);

  const focusScanner = () => window.requestAnimationFrame(() => inputRef.current?.focus());

  const resetForNextReading = () => {
    setResult(null);
    setError(null);
    focusScanner();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const scannedCode = code.trim();
    if (!scannedCode || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await resolveEquipmentScan(scannedCode, station));
      setCode("");
    } catch (scanError) {
      setError(getApiErrorMessage(scanError, "No fue posible validar el equipo escaneado."));
      setCode("");
    } finally {
      scanBuffer.current={code:'',times:[],proof:undefined};
      setBusy(false);
      focusScanner();
    }
  };

  return (
    <>
      <div className="page">
      <PageHeader report={localReport('Consulta de equipo',result?[result.equipo]:[],busy||!!error||!result,{estacion:station})}
        eyebrow="Trazabilidad física"
        title="Estación de escaneo"
        description="Identifica el equipo desde su etiqueta, valida la OS activa y abre la operación física correspondiente. Consultar no cambia la custodia."
        icon={<ScanBarcode size={21} />}
      />

      <div className="scan-shell">
        <section className="panel scan-station-panel" aria-labelledby="scan-station-title">
          <header className="section-heading">
            <div>
              <h2 className="section-title" id="scan-station-title">{stationDescription}</h2>
              <p className="muted">{canWrite ? "Identifica el equipo y abre la recepción o salida. Cada movimiento exige evidencia propia y confirmación explícita." : "Modo consulta: no se registrarán movimientos."}</p>
            </div>
            <StatusBadge tone={canWrite ? "primary" : "neutral"}>{canWrite ? "ESTACIÓN ACTIVA" : "SOLO CONSULTA"}</StatusBadge>
          </header>

          {!fixedStation ? (
            <div className="field scan-station-selector">
              <label className="field-label" htmlFor="scan-station"><MapPin size={16} /> Contexto de ubicación</label>
              <select id="scan-station" value={station} onChange={(event) => { setStation(event.target.value as ScanStation); resetForNextReading(); }} disabled={busy}>
                <option value="BODEGA">Bodega</option>
                <option value="LABORATORIO">Laboratorio</option>
                <option value="QA">Certificación QA</option>
              </select>
            </div>
          ) : null}

          <form className="scan-form" onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="equipment-scan"><Barcode size={17} /> Identificador físico</label>
            <div className="scan-input-row">
              <input
                ref={inputRef}
                id="equipment-scan"
                className="input scan-input numeric-value"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                onPaste={()=>{scanBuffer.current={code:'',times:[],proof:undefined};}}
                onKeyDown={event=>{if(station!=='QA')return;const b=scanBuffer.current;b.proof=undefined;
                  if(!event.nativeEvent.isTrusted||event.ctrlKey||event.metaKey||event.altKey||event.repeat){b.code='';b.times=[];return;}
                  if(event.key==='Enter'){b.proof=scannerProof(b.code,b.times,event.timeStamp)||undefined;return;}
                  if(event.key.length===1){if(b.times.length&&event.timeStamp-b.times.at(-1)!>80){b.code='';b.times=[];}b.code+=event.key;b.times.push(event.timeStamp);}else if(event.key!=='Shift'){b.code='';b.times=[];}
                }}
                placeholder="Escanea o ingresa serie / AMID"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={64}
                disabled={busy}
                autoFocus
              />
              <button className="btn scan-submit" type="submit" disabled={busy || !code.trim()}>
                <ScanBarcode size={19} /> {busy ? "Validando…" : "Procesar lectura"}
              </button>
            </div>
            <p className="field-hint">Escanea el QR, código de barras o ingresa el identificador. La pistola debe enviar Enter al finalizar.</p>
          </form>

          <div className="scan-live-region" aria-live="polite">
            {busy ? <span>Validando identificador, orden activa y ubicación esperada.</span> : null}
            {error ? <div className="feedback-banner" data-tone="danger" role="alert"><AlertTriangle size={18} /><strong>{error}</strong></div> : null}
          </div>
        </section>

        {result ? <div className="scan-context-column"><ResultPanel result={result} />{canWrite&&station==='QA'&&result.orden&&<button className="btn" onClick={()=>navigate(`/qa/${encodeURIComponent(result.orden!.codigo_os)}/recepcion`)}>Abrir Recepción QA</button>}{canWrite&&result.orden&&station==='LABORATORIO'&&<button className="btn" onClick={()=>navigate(`/lab/custodia/${encodeURIComponent(result.orden!.codigo_os)}/${result.orden!.estado_id===10?'salida':'recepcion'}`)}>{result.orden.estado_id===10?'Preparar salida a Bodega':'Abrir recepción en Laboratorio'}</button>}{canWrite&&result.orden&&station==='BODEGA'&&<button className="btn" onClick={()=>navigate([2,11].includes(result.orden!.estado_id)?`/bodega/recepciones/${encodeURIComponent(result.orden!.codigo_os)}`:'/bodega')}>Abrir operación de Bodega</button>}</div> : (
          <section className="panel scan-awaiting" aria-label="Lector preparado">
            <ScanBarcode size={34} />
            <h2>Lector preparado</h2>
            <p>Mantén esta pantalla abierta y pasa la etiqueta del equipo frente al lector 2D.</p>
          </section>
        )}
      </div>

      </div>
    </>
  );
}
