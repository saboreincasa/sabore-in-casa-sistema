import React from "https://esm.sh/react@18.3.1";
import ReactDOM from "https://esm.sh/react-dom@18.3.1/client";
import htmModule from "https://esm.sh/htm@3.1.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export { React, ReactDOM, createClient };

// Permite escrever style="prop:valor;prop2:valor2" (string) nos templates htm — React exige objeto.
function parseStyle(str) {
  const obj = {};
  str.split(";").forEach((decl) => {
    const idx = decl.indexOf(":");
    if (idx === -1) return;
    const prop = decl.slice(0, idx).trim();
    const value = decl.slice(idx + 1).trim();
    if (!prop || !value) return;
    obj[prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
  });
  return obj;
}

function h(type, props, ...children) {
  if (props && typeof props.style === "string") {
    props = { ...props, style: parseStyle(props.style) };
  }
  return React.createElement(type, props, ...children);
}

export const html = htmModule.bind(h);

export const {
  useState, useEffect, useMemo, useCallback, useRef, createContext, useContext,
} = React;
