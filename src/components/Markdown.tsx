import { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownProps {
  children: string;
  onCitation?: (page: number) => void;
}

function linkCitations(text: string): string {
  return text.replace(
    /\((pp?\.\s*\d+(?:\s*[–-]\s*\d+)?)\)/g,
    (whole, label: string) => {
      const match = label.match(/\d+/);
      if (!match) return whole;
      return `[${label}](#p=${match[0]})`;
    },
  );
}

export function Markdown({ children, onCitation }: MarkdownProps) {
  const source = useMemo(() => linkCitations(children), [children]);

  const components: Components = {
    a({ href, children: label }) {
      if (href?.startsWith("#p=")) {
        const page = Number(href.slice(3));
        return (
          <button
            type="button"
            className="citation"
            onClick={() => onCitation?.(page)}
            aria-label={`Open page ${page}`}
          >
            {label}
          </button>
        );
      }
      return (
        <a href={href} target="_blank" rel="noreferrer noopener">
          {label}
        </a>
      );
    },
    h1({ children: label }) {
      return <p className="md-heading">{label}</p>;
    },
    h2({ children: label }) {
      return <p className="md-heading">{label}</p>;
    },
    h3({ children: label }) {
      return <p className="md-heading">{label}</p>;
    },
    h4({ children: label }) {
      return <p className="md-heading">{label}</p>;
    },
    blockquote({ children: label }) {
      return <blockquote className="md-quote">{label}</blockquote>;
    },
  };

  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
