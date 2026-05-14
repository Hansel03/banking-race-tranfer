import { useState, useCallback } from "react";
import { CUENTAS, formatMonto, findCuentaById } from "./constants/accounts";
import type { Cuenta } from "./constants/accounts";
import { C } from "./constants/colors";
import { GameCanvas } from "./components/Game/GameCanvas";
import { S } from "./styles/theme";

export default function App() {
  const [origenId, setOrigenId] = useState(CUENTAS[0].id);
  const [destinoId, setDestinoId] = useState(CUENTAS[1].id);
  const [finalMonto, setFinalMonto] = useState(0);
  const [transferred, setTransferred] = useState(false);
  const [gameKey, setGameKey] = useState(0);

  const handleGameOver = useCallback((money: number) => {
    console.log("GAME OVER callback", money);
    setFinalMonto(money);
  }, []);

  const handlePlayAgain = () => {
    setFinalMonto(0);
    setGameKey((k) => k + 1);
    setTransferred(false);
  };

  const origen = findCuentaById(origenId) as Cuenta;
  const destino = findCuentaById(destinoId) as Cuenta;
  const sameAccount = origenId === destinoId;
  const canTransfer = finalMonto > 0 && !sameAccount;

  const btnStyle: React.CSSProperties = {
    ...S.btnTransfer,
    ...(canTransfer ? {} : S.btnTransferDisabled),
  };

  // ─── Pantalla de éxito ────────────────────────────────────────────────────
  if (transferred) {
    return (
      <div style={S.app}>
        <div style={S.scanlines} />
        <h1 style={S.title}>BHD — TRANSFERENCIA PIN PESOS</h1>
        <div style={S.successScreen}>
          <div style={{ fontSize: "28px", marginBottom: "20px" }}>✓</div>
          <div
            style={{
              color: C.success,
              fontSize: "13px",
              marginBottom: "16px",
              letterSpacing: "1px",
            }}
          >
            ¡TRANSFERENCIA EXITOSA!
          </div>
          <div style={{ color: C.muted, fontSize: "8px", marginBottom: "8px" }}>
            MONTO TRANSFERIDO
          </div>
          <div
            style={{
              color: C.primary,
              fontSize: "22px",
              marginBottom: "24px",
              textShadow: `2px 2px 0 ${C.grey700}`,
            }}
          >
            {formatMonto(finalMonto)}
          </div>
          <div style={{ color: C.muted, fontSize: "7px", marginBottom: "4px" }}>
            {origen.tipo} {origen.num} → {destino.tipo} {destino.num}
          </div>
          <div
            style={{ color: C.muted, fontSize: "7px", marginBottom: "28px" }}
          >
            {origen.alias} → {destino.alias}
          </div>
          <button
            onClick={handlePlayAgain}
            style={{ ...S.btnTransfer, background: C.primary, fontSize: "9px" }}
          >
            ▶ JUGAR DE NUEVO
          </button>
        </div>
      </div>
    );
  }

  // ─── Pantalla principal ──────────────────────────────────────────────────
  return (
    <div style={S.app}>
      <div style={S.scanlines} />
      <h1 style={S.title}>BHD — TRANSFERENCIA PIN PESOS</h1>

      {/* Selectores de cuenta */}
      <div style={S.panel}>
        <div style={S.selectRow}>
          <div>
            <label style={S.label} htmlFor="origen">
              CUENTA ORIGEN
            </label>
            <select
              id="origen"
              value={origenId}
              onChange={(e) => setOrigenId(e.target.value)}
              style={S.select}
            >
              {CUENTAS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.tipo} {c.num} — {c.alias} — $
                  {c.saldo.toLocaleString("es-DO")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.label} htmlFor="destino">
              CUENTA DESTINO
            </label>
            <select
              id="destino"
              value={destinoId}
              onChange={(e) => setDestinoId(e.target.value)}
              style={S.select}
            >
              {CUENTAS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.tipo} {c.num} — {c.alias} — $
                  {c.saldo.toLocaleString("es-DO")}
                </option>
              ))}
            </select>
          </div>
        </div>
        {sameAccount && (
          <div style={S.errorMsg}>⚠ ORIGEN Y DESTINO NO PUEDEN SER IGUALES</div>
        )}
      </div>

      {/* Divisor */}
      <div style={S.divider} />

      {/* Minijuego */}
      <div style={S.gamePanelWrapper}>
        <div style={S.gamePanelHeader}>
          <span style={S.gameLabel}>MONTO DE TRANSFERENCIA</span>
          <span style={S.gameMonto}>{formatMonto(finalMonto)}</span>
        </div>
        <GameCanvas onGameOver={handleGameOver} gameKey={gameKey} />
        <div style={S.gameInstructions}>
          <span style={S.instructionText}>← → MOVER</span>
          <span style={S.instructionText}>$ RECOGER MONEDAS (+$100 C/U)</span>
          <span style={S.dangerText}>¡EVITÁ LOS AUTOS RIVALES!</span>
        </div>
      </div>

      <div style={S.divider} />

      {/* Confirmación */}
      <div style={S.confirmPanel}>
        <div style={S.confirmGrid}>
          <div>
            <span style={S.confirmLabel}>ORIGEN</span>
            <div style={S.confirmValue}>
              <div>
                {origen.tipo} {origen.num}
              </div>
              <div
                style={{ color: C.muted, fontSize: "7px", marginTop: "4px" }}
              >
                {origen.alias}
              </div>
              <div
                style={{ color: C.muted, fontSize: "7px", marginTop: "4px" }}
              >
                Saldo: {formatMonto(origen.saldo)}
              </div>
            </div>
          </div>
          <div>
            <span style={S.confirmLabel}>DESTINO</span>
            <div style={S.confirmValue}>
              <div>
                {destino.tipo} {destino.num}
              </div>
              <div
                style={{ color: C.muted, fontSize: "7px", marginTop: "4px" }}
              >
                {destino.alias}
              </div>
            </div>
          </div>
          <div>
            <span style={S.confirmLabel}>MONTO</span>
            <div style={S.montoDisplay}>{formatMonto(finalMonto)}</div>
          </div>
        </div>

        <button
          onClick={() => {
            console.log("CLICK TRANSFER", { finalMonto, canTransfer, sameAccount });
            if (finalMonto > 0 && !sameAccount) {
              setTransferred(true);
            }
          }}
          style={{
            ...btnStyle,
            cursor: (finalMonto > 0 && !sameAccount) ? 'pointer' : 'not-allowed',
          }}
        >
          {finalMonto === 0
            ? "JUGÁ PARA DEFINIR EL MONTO"
            : sameAccount
              ? "SELECCIONÁ CUENTAS DISTINTAS"
              : `TRANSFERIR ${formatMonto(finalMonto)}`}
        </button>
      </div>
    </div>
  );
}
