/*
  할 일 한 줄
  - 기존 app.js의 createTodoElement(그리기) + startEdit(수정 모드)를 합쳤어요.
  - 사용자가 쓴 글자는 JSX에 {todo.text}로 넣어요. React가 알아서 글자로만 넣어 줘서
    <script> 같은 코드가 실행될 걱정이 없어요. (기존의 textContent와 같은 효과)
  - 한 줄 = 체크 + 글자 + ☆, 배지는 가장 중요한 것 하나만 (메인 화면 개선안 ③)
  - 글자를 누르면 모든 정보와 [수정 / 내일로 / 지우기] 메뉴가 펼쳐져요.
    지우기는 이유를 물어요: '필요 없어졌어요'(XP 그대로) / '포기할래요'(XP -10). 완료한 일은 바로 지워요.
  - ☆ 버튼을 누르면 중요한 일(⭐)이 되어 그날 목록 맨 위에 고정돼요.
  - 반복 할 일(todo.routineId)은 '내일로' 메뉴가 없어요. 수정 모드에서 '반복 그만하기'를 누를 수 있어요.
  - 폰에서는 할 일을 왼쪽으로 밀어도 '내일로'가 돼요. (터치에서만, 위아래 스크롤과 헷갈리지 않게 가로로 밀 때만)
  - 미래 날짜의 반복 미리보기(todo.isPreview)는 체크·수정·삭제 없이 흐리게만 보여 줘요.
*/
import { useEffect, useRef, useState } from "react";
import { CARRY_NAG_COUNT, MAX_TEXT_LENGTH, XP_RULES } from "../constants/game.js";
import { formatShort, todayStr } from "../utils/date.js";
import { formatRoutine, getCarryTarget, getDueInfo, weekdayOf } from "../utils/game.js";
import DayChips from "./DayChips.jsx";
import { StarIcon } from "./Icons.jsx";

// 사라지는 애니메이션(CSS) 시간과 맞춰요.
const REMOVE_ANIMATION_MS = 280;

export default function TodoItem({
  todo,
  routine, // 이 할 일을 만든 반복 틀 (반복 중일 때만, 아니면 undefined)
  selectedDate,
  onToggle,
  onDelete,
  onEdit,
  onCarry,
  onCarryInfo,
  onStopRoutine,
  onStar,
  readOnly = false, // 오프라인(보기 전용)
  onBlocked,
}) {
  if (todo.isPreview) return <PreviewItem todo={todo} routine={routine} />;
  return (
    <RealItem
      todo={todo}
      routine={routine}
      selectedDate={selectedDate}
      onToggle={onToggle}
      onDelete={onDelete}
      onEdit={onEdit}
      onCarry={onCarry}
      onCarryInfo={onCarryInfo}
      onStopRoutine={onStopRoutine}
      onStar={onStar}
      readOnly={readOnly}
      onBlocked={onBlocked}
    />
  );
}

// 반복 배지 글자: 반복 중이면 요일까지, 멈춘 반복에서 온 할 일이면 그냥 '반복'
function repeatLabel(routine) {
  return routine ? `🔁 ${formatRoutine(routine)}` : "🔁 반복";
}

// 미래 날짜의 '반복 예정' 미리보기 (아직 저장되지 않은 할 일)
function PreviewItem({ todo, routine }) {
  return (
    <li className="todo-item is-preview" aria-label={`${todo.text}, 반복 예정`}>
      <div className="todo-row">
        <span className="todo-check" aria-hidden="true">
          <span className="todo-check__box" />
        </span>
        <div className="todo-main">
          <span className="todo-text">{todo.text}</span>
          <div className="todo-meta">
            <span className="badge badge--repeat">{repeatLabel(routine)} · 반복 예정</span>
          </div>
        </div>
      </div>
    </li>
  );
}

// 접힌 줄에 보여 줄 배지 하나 고르기: 가장 급하거나 중요한 정보 하나만 (메인 화면 개선안 ③)
// 우선순위: 마감 지남·임박 → 다른 날의 할 일 → 넘어온 횟수 → 반복 → 그 밖의 마감
function pickBadge({ todo, routine, due, selectedDate, carryText }) {
  if (due && due.cls) return { text: due.text, cls: `badge--due ${due.cls}` };
  if (todo.date !== selectedDate) return { text: `${formatShort(todo.date)}의 할 일`, cls: "badge--from" };
  if (todo.carryCount > 0) return { text: carryText, cls: "badge--carry" };
  if (todo.routineId) return { text: repeatLabel(routine), cls: "badge--repeat" };
  if (due) return { text: due.text, cls: "badge--due" };
  return null;
}

function RealItem({
  todo,
  routine,
  selectedDate,
  onToggle,
  onDelete,
  onEdit,
  onCarry,
  onCarryInfo,
  onStopRoutine,
  onStar,
  readOnly,
  onBlocked,
}) {
  const today = todayStr();
  const isRoutine = !!todo.routineId;
  const [open, setOpen] = useState(false); // 글자를 눌러 [수정 / 내일로 / 지우기]를 펼쳤는지
  const [askDelete, setAskDelete] = useState(false); // 지우기를 눌러 '왜 지울까요?'를 묻는 중인지
  // 폰에서 왼쪽으로 밀어 '내일로': 밀고 있는 거리(px, 0 또는 음수)
  const [dragX, setDragX] = useState(0);
  const swipeRef = useRef(null); // { x, y, active } 손가락을 댄 위치와 가로 밀기 중인지
  const swipedRef = useRef(false); // 방금 밀었으면 손을 뗄 때 생기는 클릭(메뉴 열기)은 무시해요
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);

  // 사라지는 애니메이션을 보여 준 뒤 실제 동작을 해요. (빠르게 두 번 눌러도 한 번만)
  function removeThen(action) {
    // 오프라인(보기 전용)이면 사라지는 애니메이션 없이 안내만 해요. (애니메이션 뒤에 막히면 할 일이 안 보이게 남아요)
    if (readOnly) {
      onBlocked?.();
      return;
    }
    if (removing) return;
    setRemoving(true);
    setTimeout(action, REMOVE_ANIMATION_MS);
  }

  function handleCarry() {
    setOpen(false);
    // 넘긴 뒤 지금 보는 날짜에서 사라지면 휙 사라지는 애니메이션을 보여 줘요.
    const leavesView = getCarryTarget(todo, today) !== selectedDate;
    if (leavesView) removeThen(() => onCarry(todo.id));
    else onCarry(todo.id);
  }

  function startEdit() {
    if (readOnly) {
      onBlocked?.();
      return;
    }
    setOpen(false);
    setEditing(true);
  }

  // 지우기: 완료한 일은 XP와 상관없어서 바로 지우고, 못 한 일은 이유를 물어요.
  function handleDeleteClick() {
    if (todo.done) removeThen(() => onDelete(todo.id, "done"));
    else setAskDelete(true);
  }

  // reason: "unneeded"(필요 없어졌어요, XP 그대로) | "giveUp"(포기, XP -10)
  function confirmDelete(reason) {
    setAskDelete(false);
    setOpen(false);
    removeThen(() => onDelete(todo.id, reason));
  }

  const canCarry = !todo.done && !isRoutine; // 반복 할 일은 내일 또 오니까 넘기기 없음

  /* ---------- 왼쪽으로 밀어서 내일로 (터치에서만) ---------- */
  const SWIPE_TRIGGER = 80; // 이만큼 밀고 손을 떼면 넘겨요
  const SWIPE_MAX = 140;

  function onPointerDown(e) {
    if (e.pointerType !== "touch" || editing || !canCarry || readOnly) return;
    swipeRef.current = { x: e.clientX, y: e.clientY, active: false };
  }

  function onPointerMove(e) {
    const start = swipeRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!start.active) {
      // 위아래로 먼저 움직이면 스크롤이니까 밀기를 그만둬요.
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        swipeRef.current = null;
        return;
      }
      if (dx < -10 && Math.abs(dx) > Math.abs(dy)) {
        start.active = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } else {
        return;
      }
    }
    setDragX(Math.max(-SWIPE_MAX, Math.min(0, dx)));
  }

  function onPointerEnd() {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start?.active) return;
    swipedRef.current = true;
    if (dragX <= -SWIPE_TRIGGER) handleCarry();
    setDragX(0);
  }

  const due = getDueInfo(todo, today);
  const carryText = todo.carryCount === 1 ? "↪ 넘어옴" : `↪ ${todo.carryCount}번째`;
  const toToday = todo.date < today;
  const badge = pickBadge({ todo, routine, due, selectedDate, carryText });

  const className = [
    "todo-item",
    todo.done && "is-done",
    todo.starred && "is-starred",
    open && "is-open",
    editing && "is-editing",
    removing && "is-removing",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li className={className}>
      {/* 밀 때 뒤에 보이는 안내 */}
      {dragX < 0 && (
        <span className={`swipe-hint${dragX <= -SWIPE_TRIGGER ? " is-ready" : ""}`} aria-hidden="true">
          {toToday ? "오늘로" : "내일로"} →
        </span>
      )}
      <div
        className={`todo-row${dragX < 0 ? " is-dragging" : ""}`}
        style={dragX ? { transform: `translateX(${dragX}px)` } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(e) => {
          if (swipedRef.current) {
            swipedRef.current = false;
            e.stopPropagation();
            e.preventDefault();
          }
        }}
      >
        <label className="todo-check">
          <input
            type="checkbox"
            className="todo-check__input"
            checked={todo.done}
            onChange={() => onToggle(todo.id)}
            aria-label={`${todo.text} ${todo.done ? "완료 해제" : "완료"}`}
          />
          <span className="todo-check__box" aria-hidden="true" />
        </label>

        {editing ? (
          <EditForm
            todo={todo}
            onFinish={(changes) => {
              setEditing(false);
              if (changes) onEdit(todo.id, changes);
            }}
            // 반복 중인 할 일만 '반복 그만하기' 버튼을 보여 줘요.
            onStopRoutine={routine ? () => onStopRoutine(routine.id) : null}
          />
        ) : (
          <div className="todo-main">
            {/* 글자를 누르면 [수정 / 내일로 / 삭제]가 펼쳐져요 */}
            <button
              type="button"
              className="todo-text"
              aria-expanded={open}
              onClick={() => {
                setOpen(!open);
                setAskDelete(false);
              }}
            >
              {todo.text}
            </button>
            {/* 접혀 있을 때는 가장 중요한 배지 하나만 */}
            {!open && badge && (
              <div className="todo-meta">
                <span className={`badge ${badge.cls}`}>{badge.text}</span>
              </div>
            )}
            {/* 펼치면 모든 정보 */}
            {open && (
              <div className="todo-meta">
                {isRoutine && <span className="badge badge--repeat">{repeatLabel(routine)}</span>}
                {todo.carryCount > 0 && (
                  <button
                    type="button"
                    className={`badge badge--carry${todo.carryCount >= CARRY_NAG_COUNT ? " is-nag" : ""}`}
                    aria-label={`${carryText}, 처음 날짜 보기`}
                    onClick={() => onCarryInfo(todo)}
                  >
                    {carryText} · 처음 {formatShort(todo.originDate)}
                  </button>
                )}
                {todo.date !== selectedDate && (
                  <span className="badge badge--from">{formatShort(todo.date)}의 할 일</span>
                )}
                {due && <span className={`badge badge--due ${due.cls}`}>{due.text}</span>}
              </div>
            )}
          </div>
        )}

        {/* ⭐ 중요한 일: 누르면 그날 목록 맨 위에 고정, 다시 누르면 해제 */}
        {!editing && (
          <button
            type="button"
            className={`star-btn${todo.starred ? " is-on" : ""}`}
            aria-label={todo.starred ? "중요 표시 해제" : "중요한 일로 표시"}
            aria-pressed={!!todo.starred}
            onClick={() => onStar(todo.id)}
          >
            <StarIcon filled={!!todo.starred} width={22} height={22} />
          </button>
        )}
      </div>

      {/* 펼친 메뉴: 수정 / 내일로·오늘로 / 지우기 */}
      {open && !editing && !askDelete && (
        <div className="todo-menu">
          <button type="button" className="todo-menu__btn" onClick={startEdit}>
            수정
          </button>
          {canCarry && (
            <button type="button" className="todo-menu__btn todo-menu__btn--carry" onClick={handleCarry}>
              {toToday ? "오늘로" : "내일로"} · XP {XP_RULES.CARRY}
            </button>
          )}
          <button type="button" className="todo-menu__btn todo-menu__btn--danger" onClick={handleDeleteClick}>
            지우기
          </button>
        </div>
      )}

      {/* 지우기를 누르면: 왜 지울까요? (필요 없어짐은 XP 그대로, 포기는 XP -10) */}
      {open && !editing && askDelete && (
        <div className="todo-menu todo-menu--ask" role="group" aria-label="왜 지울까요?">
          <span className="todo-menu__question">왜 지울까요?</span>
          <div className="todo-menu__row">
            <button type="button" className="todo-menu__btn" onClick={() => confirmDelete("unneeded")}>
              필요 없어졌어요
            </button>
            <button type="button" className="todo-menu__btn todo-menu__btn--danger" onClick={() => confirmDelete("giveUp")}>
              포기할래요 · XP {XP_RULES.GIVE_UP}
            </button>
          </div>
          <button type="button" className="todo-menu__cancel" onClick={() => setAskDelete(false)}>
            취소
          </button>
        </div>
      )}
    </li>
  );
}

/*
  수정 모드: 글자 입력칸 + 마감일 입력칸
  - Enter: 저장 / Esc: 취소 / 이 할 일 밖으로 포커스가 나가면 저장
  - onFinish(changes): 바뀐 게 있으면 { text, dueDate }, 없거나 취소면 null
  - onStopRoutine: 반복 중인 할 일이면 '반복 그만하기' 버튼을 보여 줘요. (아니면 null)
    글자를 고친 건 오늘 할 일에만 반영되고, 반복 틀은 그대로예요.
  - 보통 할 일이면 '🔁 반복' 버튼으로 반복 할 일로 바꿀 수 있어요.
    이때 onFinish에 repeat: { days, endDate }가 함께 와요. (그 할 일 날짜부터 반복)
*/
function EditForm({ todo, onFinish, onStopRoutine }) {
  const [text, setText] = useState(todo.text);
  const [dueDate, setDueDate] = useState(todo.dueDate || "");
  const canRepeat = !todo.routineId; // 이미 반복 할 일이면 반복으로 바꾸는 버튼은 없어요
  const [repeat, setRepeat] = useState(false);
  const [days, setDays] = useState(() => [weekdayOf(todo.date)]); // 그 할 일의 요일을 미리 골라 둬요
  const [repeatEnd, setRepeatEnd] = useState(""); // 반복 종료일 (비우면 계속 반복)
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const finishedRef = useRef(false); // Enter와 포커스 이동이 동시에 일어나도 한 번만 처리

  // 수정 모드가 열리면 글자 입력칸에 바로 커서를 둬요.
  useEffect(() => {
    inputRef.current.focus();
    inputRef.current.select();
  }, []);

  function finish(save) {
    if (finishedRef.current) return;
    finishedRef.current = true;

    if (!save) return onFinish(null);
    const newText = text.trim().slice(0, MAX_TEXT_LENGTH);
    const newDue = dueDate || null;
    const textChanged = !!newText && newText !== todo.text;
    const dueChanged = newDue !== (todo.dueDate || null);
    const repeatChange = canRepeat && repeat ? { days, endDate: repeatEnd || null } : null;
    if (!textChanged && !dueChanged && !repeatChange) return onFinish(null);
    onFinish({ text: textChanged ? newText : todo.text, dueDate: newDue, repeat: repeatChange });
  }

  function handleKeyDown(e) {
    // 한글 조합 중 Enter는 무시해요. (조합이 끝난 뒤 다시 누른 Enter로 저장)
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      finish(true);
    }
    if (e.key === "Escape") finish(false);
  }

  // 글자칸 ↔ 마감일칸 사이 이동은 괜찮고, 이 할 일 밖으로 포커스가 나가면 저장해요.
  // (날짜 선택 달력이 열릴 때 잠깐 포커스가 흔들리는 경우가 있어서 0.15초 뒤에 다시 확인해요)
  function handleBlur() {
    setTimeout(() => {
      if (wrapRef.current && !wrapRef.current.contains(document.activeElement)) finish(true);
    }, 150);
  }

  return (
    <div className="todo-main" ref={wrapRef} onKeyDown={handleKeyDown} onBlur={handleBlur}>
      <input
        ref={inputRef}
        type="text"
        className="todo-edit"
        value={text}
        maxLength={MAX_TEXT_LENGTH}
        aria-label="할 일 수정"
        onChange={(e) => setText(e.target.value)}
      />
      {/* 마감일: 반복을 켜면 숨겨요 (반복 종료일과 헷갈리지 않게, 추가 폼과 같게) */}
      {!(canRepeat && repeat) && (
        <label className="todo-edit-due">
          <span>📅 마감일</span>
          <input
            type="date"
            className="due-input"
            value={dueDate}
            min={todo.date}
            aria-label="마감일 수정 (비우면 없음)"
            onChange={(e) => setDueDate(e.target.value)}
          />
        </label>
      )}
      {/* 보통 할 일 → 반복 할 일로 바꾸기 (버튼을 눌러도 입력칸의 포커스를 뺏지 않게 onMouseDown을 막아요) */}
      {canRepeat && (
        <div className="todo-edit-repeat">
          <button
            type="button"
            className={`repeat-toggle${repeat ? " is-on" : ""}`}
            aria-pressed={repeat}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setRepeat(!repeat)}
          >
            🔁 반복
          </button>
          {repeat && (
            <label className="todo-edit-due">
              <span>📅 반복 종료일</span>
              <input
                type="date"
                className="due-input"
                value={repeatEnd}
                min={todo.date}
                aria-label="반복 종료일 (비우면 계속 반복)"
                onChange={(e) => setRepeatEnd(e.target.value)}
              />
            </label>
          )}
        </div>
      )}
      {canRepeat && repeat && <DayChips days={days} onChange={setDays} keepFocus />}

      {onStopRoutine && (
        <button
          type="button"
          className="stop-repeat-btn"
          onClick={() => {
            finish(true); // 고치던 내용은 저장하고
            onStopRoutine(); // 반복은 멈춰요 (오늘 할 일은 남아요)
          }}
        >
          🔁 반복 그만하기
        </button>
      )}
    </div>
  );
}
