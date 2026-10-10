/**
 * Parses JSON or a JavaScript object literal like the ones in the old assets/data.js
 * (unquoted keys, single quotes, comments, trailing commas). Never evaluates code.
 */
export function parseLoose(text: string): unknown {
  const src = text.trim().replace(/^[,;]+|[,;]+$/g, "");
  try {
    return JSON.parse(src);
  } catch {
    return JSON.parse(toJson(src));
  }
}

function toJson(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  const lastSignificant = () => {
    for (let j = out.length - 1; j >= 0; j--) if (!/\s/.test(out[j])) return out[j];
    return "";
  };

  while (i < n) {
    const c = src[i];
    // strings
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      let s = "";
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\" && i + 1 < n) {
          const next = src[i + 1];
          if (next === quote && quote !== '"') s += next;
          else s += src[i] + next;
          i += 2;
          continue;
        }
        if (src[i] === '"' && quote !== '"') s += '\\"';
        else if (src[i] === "\n") s += "\\n";
        else s += src[i];
        i++;
      }
      i++;
      out += `"${s}"`;
      continue;
    }
    // comments
    if (c === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    // trailing commas
    if (c === "}" || c === "]") {
      out = out.replace(/,\s*$/, "");
      out += c;
      i++;
      continue;
    }
    // bare keys
    if (/[A-Za-z_$]/.test(c) && (lastSignificant() === "{" || lastSignificant() === ",")) {
      let j = i;
      while (j < n && /[\w$]/.test(src[j])) j++;
      let k = j;
      while (k < n && /\s/.test(src[k])) k++;
      if (src[k] === ":") {
        out += `"${src.slice(i, j)}"`;
        i = j;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}
