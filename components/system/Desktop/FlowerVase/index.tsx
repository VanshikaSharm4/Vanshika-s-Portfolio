import { useCallback, useEffect, useRef, useState } from "react";
import styles from "components/system/Desktop/FlowerVase/vase.module.css";

const PALETTE = [
  { name: "Rose", value: "#cc476d" },
  { name: "Lavender", value: "#785ab5" },
  { name: "Sunflower", value: "#a86613" },
  { name: "Leaf green", value: "#397a61" },
  { name: "Sky blue", value: "#386eaa" },
];
const PAD_SIZE = 280;
const NOTE_LENGTH = 200;
const FLOWER_API = process.env.NEXT_PUBLIC_FLOWER_VASE_API;

type Flower = { drawing: string; id: string; note: string };
type FlowerPage = { flowers: Flower[]; nextCursor: null | number };
type Point = { x: number; y: number };
type DrawingEvent = React.PointerEvent<HTMLCanvasElement>;

const fetchFlowers = async (
  api: string,
  signal: AbortSignal,
  before?: number
): Promise<FlowerPage> => {
  const endpoint = new URL(api);
  if (before !== undefined) endpoint.searchParams.set("before", String(before));
  const response = await fetch(endpoint, { signal });
  if (!response.ok) throw new Error("Could not load the bouquet.");

  return response.json() as Promise<FlowerPage>;
};

const publishFlower = async (api: string, flower: Flower): Promise<Flower> => {
  const response = await fetch(api, {
    body: JSON.stringify(flower),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(response.status === 429 ? "rate limit" : "save failed");
  }

  return response.json() as Promise<Flower>;
};

const getPoint = ({ clientX, clientY, currentTarget }: DrawingEvent): Point => {
  const bounds = currentTarget.getBoundingClientRect();

  return {
    x: ((clientX - bounds.left) / bounds.width) * PAD_SIZE,
    y: ((clientY - bounds.top) / bounds.height) * PAD_SIZE,
  };
};

const paint = (
  context: CanvasRenderingContext2D,
  start: Point,
  end: Point
): void => {
  context.beginPath();
  if (start.x === end.x && start.y === end.y) {
    context.arc(start.x, start.y, 2.5, 0, Math.PI * 2);
    context.fill();
  } else {
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }
};

const FlowerVase: FC = () => {
  const [flowers, setFlowers] = useState<Flower[]>([]);
  const [nextCursor, setNextCursor] = useState<number>();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [color, setColor] = useState(PALETTE[0].value);
  const [editCount, setEditCount] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const activeStroke = useRef<{ id: number; point: Point } | undefined>(
    undefined
  );
  const undoStack = useRef<ImageData[]>([]);
  const activeLoad = useRef<AbortController | undefined>(undefined);
  const pendingFlower = useRef<Flower | undefined>(undefined);
  const isSaving = useRef(false);

  const loadFlowers = useCallback(async (before?: number): Promise<void> => {
    if (!FLOWER_API) return;

    activeLoad.current?.abort();
    const controller = new AbortController();
    activeLoad.current = controller;
    setLoading(true);
    setLoadError(false);

    try {
      const page = await fetchFlowers(FLOWER_API, controller.signal, before);

      if (!controller.signal.aborted) {
        setFlowers((current) =>
          before === undefined ? page.flowers : [...current, ...page.flowers]
        );
        setNextCursor(page.nextCursor ?? undefined);
      }
    } catch {
      if (!controller.signal.aborted) setLoadError(true);
    }
    if (!controller.signal.aborted) setLoading(false);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      loadFlowers();
    }, 0);

    return () => {
      window.clearTimeout(initialLoad);
      activeLoad.current?.abort();
    };
  }, [loadFlowers]);

  const rememberCanvas = (context: CanvasRenderingContext2D): void => {
    undoStack.current.push(context.getImageData(0, 0, PAD_SIZE, PAD_SIZE));
    if (undoStack.current.length > 24) undoStack.current.splice(1, 1);
    setEditCount(undoStack.current.length);
  };

  const clear = (): void => {
    canvas.current?.getContext("2d")?.clearRect(0, 0, PAD_SIZE, PAD_SIZE);
    undoStack.current = [];
    activeStroke.current = undefined;
    setEditCount(0);
  };

  const undo = (): void => {
    const prior = undoStack.current.pop();
    if (!prior) return;
    canvas.current?.getContext("2d")?.putImageData(prior, 0, 0);
    setEditCount(undoStack.current.length);
  };

  const startDrawing = (event: DrawingEvent): void => {
    if (event.button !== 0 || activeStroke.current || isSaving.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;

    const point = getPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    rememberCanvas(context);
    activeStroke.current = { id: event.pointerId, point };
    context.fillStyle = color;
    context.strokeStyle = color;
    context.lineCap = "round";
    context.lineWidth = 5;
    paint(context, point, point);
  };

  const continueDrawing = (event: DrawingEvent): void => {
    const stroke = activeStroke.current;
    if (stroke?.id !== event.pointerId) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;

    const point = getPoint(event);
    paint(context, stroke.point, point);
    stroke.point = point;
  };

  const endDrawing = ({ pointerId }: DrawingEvent): void => {
    if (activeStroke.current?.id === pointerId) {
      activeStroke.current = undefined;
    }
  };

  const stampFlower = (): void => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    rememberCanvas(context);
    context.fillStyle = color;
    for (let petal = 0; petal < 6; petal += 1) {
      const angle = (petal * Math.PI) / 3;
      context.beginPath();
      context.ellipse(
        140 + Math.cos(angle) * 43,
        140 + Math.sin(angle) * 43,
        37,
        20,
        angle,
        0,
        Math.PI * 2
      );
      context.fill();
    }
    context.fillStyle = "#f8d18e";
    context.beginPath();
    context.arc(140, 140, 21, 0, Math.PI * 2);
    context.fill();
  };

  const submit = async (
    event: React.SubmitEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();
    if (!FLOWER_API || !canvas.current || !editCount || isSaving.current) {
      return;
    }
    isSaving.current = true;
    setSaving(true);
    setSubmissionError("");

    try {
      const drawing = canvas.current.toDataURL("image/png");
      const trimmedNote = note.trim();
      const prior = pendingFlower.current;
      const flower =
        prior?.drawing === drawing && prior.note === trimmedNote
          ? prior
          : { drawing, id: crypto.randomUUID(), note: trimmedNote };
      pendingFlower.current = flower;

      const saved = await publishFlower(FLOWER_API, flower);
      setFlowers((current) => [
        saved,
        ...current.filter(({ id }) => id !== saved.id),
      ]);
      pendingFlower.current = undefined;
      setNote("");
      clear();
      setAnnouncement("Your flower is in the shared vase.");
      dialog.current?.close();
      loadFlowers();
    } catch (error) {
      const message =
        error instanceof Error && error.message === "rate limit"
          ? "Please wait a minute before trying again."
          : "Couldn’t add your flower. Try again when you’re connected.";
      setSubmissionError(message);
    }
    isSaving.current = false;
    setSaving(false);
  };

  const openVase = (): void => {
    dialog.current?.showModal();
    loadFlowers();
  };

  return (
    <>
      <button
        aria-haspopup="dialog"
        className={styles.launcher}
        onClick={openVase}
        type="button"
      >
        <span aria-hidden="true" className={styles.bouquet}>
          {[0, 1, 2, 3, 4].map((slot) => (
            <span key={slot} className={styles.stem} data-slot={slot}>
              <svg
                className={styles.stemLine}
                preserveAspectRatio="none"
                viewBox="0 0 16 80"
              >
                <path d="M8 0C0 16 0 27 8 39S16 62 8 80" />
              </svg>
              {flowers[slot] ? (
                <img
                  alt=""
                  className={styles.bloom}
                  draggable={false}
                  src={flowers[slot].drawing}
                />
              ) : (
                <span className={styles.petal} />
              )}
            </span>
          ))}
          <span className={styles.vase} />
        </span>
        <span className={styles.launcherLabel}>
          Leave a flower <span aria-hidden="true">↗</span>
        </span>
      </button>
      <span className={styles.srOnly} role="status">
        {announcement}
      </span>
      <dialog
        ref={dialog}
        aria-labelledby="flower-vase-title"
        className={styles.dialog}
      >
        <header className={styles.header}>
          <div>
            <h2 id="flower-vase-title">The flower vase</h2>
            <p>Draw a flower and tuck a little note beside it.</p>
          </div>
          <button
            aria-label="Close flower vase"
            className={styles.close}
            onClick={() => dialog.current?.close()}
            type="button"
          >
            ×
          </button>
        </header>
        <form className={styles.form} onSubmit={submit}>
          <div className={styles.drawingArea}>
            <canvas
              ref={canvas}
              aria-label="Flower drawing pad. Draw with a mouse, pen, or finger, or choose Use a flower stamp."
              className={styles.canvas}
              height={PAD_SIZE}
              onLostPointerCapture={endDrawing}
              onPointerCancel={endDrawing}
              onPointerDown={startDrawing}
              onPointerMove={continueDrawing}
              onPointerUp={endDrawing}
              width={PAD_SIZE}
            />
            <div aria-label="Ink color" className={styles.palette} role="group">
              {PALETTE.map((ink) => (
                <button
                  key={ink.name}
                  aria-label={ink.name}
                  aria-pressed={ink.value === color}
                  className={styles.swatch}
                  disabled={saving}
                  onClick={() => setColor(ink.value)}
                  style={{ backgroundColor: ink.value }}
                  type="button"
                />
              ))}
            </div>
            <div className={styles.tools}>
              <button
                disabled={!editCount || saving}
                onClick={undo}
                type="button"
              >
                Undo
              </button>
              <button
                disabled={!editCount || saving}
                onClick={clear}
                type="button"
              >
                Clear
              </button>
              <button disabled={saving} onClick={stampFlower} type="button">
                Use a flower stamp
              </button>
            </div>
          </div>
          <div className={styles.message}>
            <label htmlFor="flower-vase-note">
              Your note <span>(optional)</span>
            </label>
            <textarea
              disabled={saving}
              id="flower-vase-note"
              maxLength={NOTE_LENGTH}
              onChange={({ target }) => setNote(target.value)}
              placeholder="Something kind, something small…"
              rows={4}
              value={note}
            />
            <button
              className={styles.submit}
              disabled={!FLOWER_API || !editCount || saving}
              type="submit"
            >
              {saving ? "Adding your flower…" : "Add to the vase"}
            </button>
            <p className={styles.storage}>
              {FLOWER_API
                ? "Your flower and note will be visible to everyone."
                : "The shared vase isn’t connected yet."}
            </p>
            {submissionError && (
              <p className={styles.error} role="alert">
                {submissionError}
              </p>
            )}
          </div>
        </form>
        {loadError && (
          <p className={styles.error} role="status">
            Couldn’t load the bouquet. Try reopening the vase.
          </p>
        )}
        {flowers.length > 0 && (
          <section aria-label="Saved flowers" className={styles.saved}>
            <h3>Flowers in this vase</h3>
            <ul>
              {flowers.map((flower) => (
                <li key={flower.id}>
                  <img
                    alt="Saved flower drawing"
                    draggable={false}
                    src={flower.drawing}
                  />
                  {flower.note && <p>{flower.note}</p>}
                </li>
              ))}
            </ul>
            {nextCursor !== undefined && (
              <div className={styles.tools}>
                <button
                  disabled={loading}
                  onClick={() => loadFlowers(nextCursor)}
                  type="button"
                >
                  {loading ? "Loading…" : "Load older flowers"}
                </button>
              </div>
            )}
          </section>
        )}
      </dialog>
    </>
  );
};

export default FlowerVase;
