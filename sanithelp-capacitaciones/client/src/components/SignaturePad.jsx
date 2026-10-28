import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

const COLOR = '#0b2a5b';

/**
 * Lienzo de firma que funciona con mouse, lápiz y pantalla táctil.
 * Guarda cada trazo por separado para poder deshacer el último.
 * Con `trazosIniciales` y `onTrazos` la firma se puede pre-guardar y recuperar.
 * Expone: limpiar(), estaVacio(), obtenerImagen() -> dataURL PNG.
 */
const SignaturePad = forwardRef(function SignaturePad({ onCambio, onTrazos, trazosIniciales }, ref) {
  const canvasRef = useRef(null);
  const trazos = useRef(Array.isArray(trazosIniciales) ? trazosIniciales : []); // [[{x, y}, …], …]
  const actual = useRef(null);
  const [cantidad, setCantidad] = useState(trazos.current.length);

  const avisar = () => {
    setCantidad(trazos.current.length);
    onCambio?.(trazos.current.length === 0);
    onTrazos?.(trazos.current);
  };

  const dibujarTodo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const t of trazos.current) dibujarTrazo(ctx, t);
  };

  const dibujarTrazo = (ctx, t) => {
    if (t.length === 1) {
      ctx.beginPath();
      ctx.arc(t[0].x, t[0].y, 1.2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(t[0].x, t[0].y);
    for (let i = 1; i < t.length; i++) ctx.lineTo(t[i].x, t[i].y);
    ctx.stroke();
  };

  const ajustarTamano = () => {
    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COLOR;
    ctx.fillStyle = COLOR;
    dibujarTodo();
  };

  useEffect(() => {
    if (trazos.current.length) onCambio?.(false); // firma recuperada
    ajustarTamano();
    window.addEventListener('resize', ajustarTamano);
    return () => window.removeEventListener('resize', ajustarTamano);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const punto = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const iniciar = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    actual.current = [punto(e)];
    dibujarTrazo(canvasRef.current.getContext('2d'), actual.current);
  };

  const mover = (e) => {
    if (!actual.current) return;
    const p = punto(e);
    const t = actual.current;
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(t[t.length - 1].x, t[t.length - 1].y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    t.push(p);
  };

  const terminar = () => {
    if (!actual.current) return;
    trazos.current.push(actual.current);
    actual.current = null;
    avisar();
  };

  const deshacer = () => {
    trazos.current.pop();
    dibujarTodo();
    avisar();
  };

  const limpiar = () => {
    trazos.current = [];
    dibujarTodo();
    avisar();
  };

  useImperativeHandle(ref, () => ({
    limpiar,
    estaVacio: () => trazos.current.length === 0,
    obtenerImagen: () => canvasRef.current.toDataURL('image/png'),
  }));

  const vacio = cantidad === 0;

  return (
    <div className="firma">
      <canvas
        ref={canvasRef}
        className="firma-canvas"
        onPointerDown={iniciar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerLeave={terminar}
        onPointerCancel={terminar}
      />
      {vacio && <span className="firma-placeholder">Firme aquí</span>}
      <div className="firma-linea" />
      <div className="firma-botones">
        <button type="button" className="btn btn-texto firma-limpiar" onClick={deshacer} disabled={vacio}>↶ Deshacer</button>
        <button type="button" className="btn btn-texto firma-limpiar" onClick={limpiar} disabled={vacio}>Borrar todo</button>
      </div>
    </div>
  );
});

export default SignaturePad;
