import {
  CreateStartUpPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  type EvenAppBridge,
} from "@evenrealities/even_hub_sdk";
import type { LoCard } from "../types";

const CONTAINER_ID = 1;
const CONTAINER_NAME = "lo";
const SCREEN_WIDTH = 576;
const SCREEN_HEIGHT = 288;
const MAX_ROWS = 9;
const LINE_WIDTH = 48;

export interface GlassesDisplay {
  render(cards: LoCard[], index: number, status?: string): void;
  shutdown(): Promise<void>;
}

function clip(value: string, width = LINE_WIDTH): string {
  if (value.length <= width) return value;
  return `${value.slice(0, Math.max(1, width - 1))}…`;
}

function wrap(value: string, width = LINE_WIDTH): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line) {
      line = word;
    } else if (`${line} ${word}`.length <= width) {
      line += ` ${word}`;
    } else {
      lines.push(clip(line, width));
      line = word;
    }
  }
  if (line) lines.push(clip(line, width));
  return lines;
}

function cardText(cards: LoCard[], index: number, status = ""): string {
  if (cards.length === 0) return status || "lo\n\nOpen Even App on your phone to continue.";
  const selected = cards[Math.min(Math.max(0, index), cards.length - 1)];
  const header = `${selected.label.toUpperCase()}  ${index + 1}/${cards.length}`;
  const rows = [header, clip(selected.title)];
  if (selected.hero) rows.push(clip(selected.hero));
  for (const line of selected.lines) rows.push(...wrap(line));
  if (selected.meta) rows.push(clip(selected.meta));
  const bodyRows = status ? MAX_ROWS - 1 : MAX_ROWS;
  const visible = rows.slice(0, bodyRows);
  if (status) visible.push(clip(status));
  return visible.join("\n");
}

export async function createGlassesDisplay(bridge: EvenAppBridge): Promise<GlassesDisplay> {
  const main = new TextContainerProperty({
    xPosition: 1,
    yPosition: 1,
    width: SCREEN_WIDTH - 2,
    height: SCREEN_HEIGHT - 2,
    borderWidth: 1,
    borderColor: 5,
    borderRadius: 9,
    paddingLength: 5,
    containerID: CONTAINER_ID,
    containerName: CONTAINER_NAME,
    content: "lo\n\nConnecting to your phone…",
    isEventCapture: 1,
  });

  const delays = [0, 200, 500, 1000];
  let created = 1;
  for (const delay of delays) {
    if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
    created = await bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({ containerTotalNum: 1, textObject: [main] }),
    );
    if (created === 0) break;
  }
  if (created !== 0) console.warn(`createStartUpPageContainer returned ${created}`);

  let sending = false;
  let pending = "";

  async function send(content: string) {
    pending = content;
    if (sending) return;
    sending = true;
    while (pending) {
      const next = pending;
      pending = "";
      await bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: CONTAINER_ID,
          containerName: CONTAINER_NAME,
          contentOffset: 0,
          contentLength: next.length,
          content: next,
        }),
      );
    }
    sending = false;
  }

  return {
    render(cards, index, status = "") {
      void send(cardText(cards, index, status));
    },
    async shutdown() {
      await bridge.shutDownPageContainer(0);
    },
  };
}

export function createBrowserDisplay(): GlassesDisplay {
  return {
    render() {},
    async shutdown() {},
  };
}

