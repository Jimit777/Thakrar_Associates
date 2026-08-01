"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { clearChat } from "@/app/(app)/analyzer/chat-actions";

const STATUS_SEPARATOR = String.fromCharCode(30);

export type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Replies come back as markdown — headings, tables, emphasis. Rendered rather
 * than shown raw, since a table of figures as plain pipes is unreadable.
 */
function AnswerBody({ content }: { content: string }) {
  return (
    <div className="space-y-3">
      <ReactMarkdown
        // Tables are not part of base markdown — without this plugin they
        // arrive as raw pipe characters.
        remarkPlugins={[remarkGfm]}
        components={{
          p: (props) => <p className="leading-relaxed" {...props} />,
          ul: (props) => <ul className="list-disc space-y-1 pl-5" {...props} />,
          ol: (props) => <ol className="list-decimal space-y-1 pl-5" {...props} />,
          strong: (props) => <strong className="font-semibold" {...props} />,
          em: (props) => <em className="italic text-muted" {...props} />,
          code: (props) => (
            <code className="figure rounded bg-background px-1 py-0.5 text-xs" {...props} />
          ),
          a: (props) => (
            <a
              className="text-accent underline"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          table: (props) => (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full border-collapse text-xs" {...props} />
            </div>
          ),
          thead: (props) => <thead className="bg-background" {...props} />,
          th: (props) => (
            <th
              className="stat-label border-b border-border px-3 py-2 text-right first:text-left"
              {...props}
            />
          ),
          td: (props) => (
            <td
              className="figure border-b border-border px-3 py-1.5 text-right last:border-b-0 first:text-left first:font-sans"
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

const SUGGESTIONS = [
  "How have revenue and profit moved across the periods I've saved?",
  "What do the margins show, and what's driving the change?",
  "What's the recent news on this company?",
  "How does this compare with its listed competitors?",
];

export function StockChat({
  stockId,
  symbol,
  initialMessages,
  hasFinancials,
}: {
  stockId: string;
  symbol: string;
  initialMessages: ChatMessage[];
  hasFinancials: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [thinking, setThinking] = useState("");
  const [showThinking, setShowThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || streaming) return;

    setError(null);
    setInput("");
    setMessages((current) => [
      ...current,
      { role: "user", content: trimmed },
      { role: "assistant", content: "" },
    ]);
    setStreaming(true);
    setStatus("Thinking");
    setThinking("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockId, message: trimmed }),
      });

      if (!response.ok || !response.body) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.error ?? "The request failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Status updates arrive on the same stream, wrapped in record separators.
      // Buffered because a frame can be split across two chunks.
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let text = "";

        for (;;) {
          const start = buffer.indexOf(STATUS_SEPARATOR);
          if (start === -1) {
            text += buffer;
            buffer = "";
            break;
          }

          text += buffer.slice(0, start);
          const end = buffer.indexOf(STATUS_SEPARATOR, start + 1);

          if (end === -1) {
            // Frame is incomplete — keep it for the next chunk.
            buffer = buffer.slice(start);
            break;
          }

          try {
            const frame = JSON.parse(buffer.slice(start + 1, end));

            if (frame?.type === "status") setStatus(frame.label as string);

            if (frame?.type === "thinking") {
              setThinking((current) => current + (frame.text as string));
            }
          } catch {
            // Not a status frame after all; treat it as ordinary text.
            text += buffer.slice(start, end + 1);
          }

          buffer = buffer.slice(end + 1);
        }

        if (text) {
          setMessages((current) => {
            const next = [...current];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content + text };
            return next;
          });

          endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
      // Drop the empty reply so a failed turn doesn't look like a silent answer.
      setMessages((current) =>
        current[current.length - 1]?.content === ""
          ? current.slice(0, -1)
          : current,
      );
    } finally {
      setStreaming(false);
      setStatus(null);
    }
  }

  return (
    <section className="mt-8 rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">Ask about {symbol}</h2>
          <p className="mt-0.5 text-xs text-muted">
            Uses your confirmed figures first, and searches the web for what they
            don&apos;t cover. Every answer says which source it used.
          </p>
        </div>

        {messages.length > 0 && (
          <form
            action={async (formData) => {
              await clearChat(formData);
              setMessages([]);
            }}
          >
            <input type="hidden" name="stock_id" value={stockId} />
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:border-negative hover:text-negative"
            >
              Clear chat
            </button>
          </form>
        )}
      </div>

      {!hasFinancials && (
        <p className="mt-4 rounded-md border border-border bg-surface-sunken p-3 text-sm text-muted">
          No confirmed figures for this stock yet. You can still ask questions,
          but there&apos;s little to answer from — upload a report and extract it
          first.
        </p>
      )}

      {messages.length === 0 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => send(suggestion)}
              className="rounded-md border border-border px-3 py-2 text-left text-sm text-muted transition-colors hover:border-accent hover:text-foreground"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex max-h-[28rem] flex-col gap-4 overflow-y-auto pr-1">
          {messages.map((message, index) => (
            <div
              key={index}
              className={
                message.role === "user"
                  ? "self-end rounded-lg rounded-br-sm bg-accent px-3 py-2 text-sm text-background sm:max-w-[80%]"
                  : "rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm leading-relaxed"
              }
            >
              {message.content === "" ? (
                <div>
                  <p className="text-muted">{status ?? "Thinking"}…</p>
                  {thinking && (
                    <p className="mt-2 max-h-32 overflow-y-auto border-l-2 border-border pl-3 text-xs leading-relaxed text-muted">
                      {thinking}
                    </p>
                  )}
                </div>
              ) : message.role === "user" ? (
                <span className="whitespace-pre-wrap">{message.content}</span>
              ) : (
                <>
                  {/* Reasoning for the most recent answer, tucked away once
                      the answer itself has arrived. */}
                  {thinking && index === messages.length - 1 && (
                    <div className="mb-2">
                      <button
                        type="button"
                        onClick={() => setShowThinking((open) => !open)}
                        className="text-xs text-muted underline"
                      >
                        {showThinking ? "Hide reasoning" : "Show reasoning"}
                      </button>
                      {showThinking && (
                        <p className="mt-1.5 border-l-2 border-border pl-3 text-xs leading-relaxed text-muted">
                          {thinking}
                        </p>
                      )}
                    </div>
                  )}
                  <AnswerBody content={message.content} />
                </>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      {error && <p className="mt-3 text-sm text-negative">{error}</p>}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={`Ask something about ${symbol}…`}
          disabled={streaming}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {streaming ? "…" : "Ask"}
        </button>
      </form>
    </section>
  );
}
