"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

export type AgentsLayoutMode = "auto" | "horiz" | "vert";

export interface AgentsLayoutResult {
  cols: number;
  rows: number;
  /** CSS inline style pronto pra aplicar em `.agents-terminals` */
  style: { gridTemplateColumns: string; gridTemplateRows: string };
}

/**
 * Calcula `cols × rows` ideais para o grid de terminais.
 *
 * Modos:
 *   - `horiz`: prioriza colunas (lado a lado), tendência horizontal.
 *   - `vert`:  prioriza linhas (empilhamento), tendência vertical.
 *   - `auto`:  decide com base no aspect ratio do container.
 *
 * Para `auto`, usa um `ResizeObserver` interno que mede o `containerRef`
 * passado e atualiza `aspect = width/height` em tempo real.
 */
export function useAgentsLayout(
  count: number,
  mode: AgentsLayoutMode,
  containerRef: RefObject<HTMLElement | null>
): AgentsLayoutResult {
  const [aspect, setAspect] = useState<number>(1.5);
  const lastAspectRef = useRef<number>(1.5);

  useEffect(() => {
    if (mode !== "auto") return;
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w === 0 || h === 0) return;
      const a = w / h;
      // Throttle: só atualiza se mudou > 0.1 (evita re-render absurdo)
      if (Math.abs(a - lastAspectRef.current) > 0.1) {
        lastAspectRef.current = a;
        setAspect(a);
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode, containerRef]);

  return useMemo<AgentsLayoutResult>(() => {
    if (count <= 0) {
      return {
        cols: 1,
        rows: 1,
        style: { gridTemplateColumns: "1fr", gridTemplateRows: "1fr" },
      };
    }
    if (count === 1) {
      return {
        cols: 1,
        rows: 1,
        style: { gridTemplateColumns: "1fr", gridTemplateRows: "1fr" },
      };
    }

    let cols = 1;
    let rows = 1;

    if (mode === "horiz") {
      // Prioriza linha: até 4 lado a lado, depois quebra em N/3 colunas
      cols = count <= 4 ? count : 3;
      rows = Math.ceil(count / cols);
    } else if (mode === "vert") {
      // Prioriza coluna: até 3 empilhados, depois 2 colunas
      rows = count <= 3 ? count : Math.ceil(count / 2);
      cols = Math.ceil(count / rows);
    } else {
      // auto: decide por aspect ratio
      if (count === 2) {
        cols = aspect > 1 ? 2 : 1;
        rows = aspect > 1 ? 1 : 2;
      } else if (count <= 4) {
        cols = 2;
        rows = 2;
      } else if (count <= 6) {
        cols = aspect > 1.2 ? 3 : 2;
        rows = Math.ceil(count / cols);
      } else {
        cols = 3;
        rows = Math.ceil(count / cols);
      }
    }

    // Colunas: minmax(0, 1fr) — deixa shrinkar, não gera scroll horizontal.
    // Linhas: minmax(280px, 1fr) — respeita altura mínima legível;
    //   quando rows × 280 > altura disponível, ativa scroll vertical no container.
    return {
      cols,
      rows,
      style: {
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(280px, 1fr))`,
      },
    };
  }, [count, mode, aspect]);
}
