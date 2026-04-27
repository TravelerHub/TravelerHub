import { Fragment, useMemo } from "react";
import MessageBubble from "./MessagerBubble";
import DateDivider from "./DateDivider";

// Two messages are in the same "cluster" if they're from the same sender AND
// were sent within this many ms of each other. 3 minutes matches what Telegram
// uses to merge consecutive messages.
const CLUSTER_GAP_MS = 3 * 60 * 1000;

function sameDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function clusterPosition(prev, curr, next) {
  const sameAsPrev =
    prev &&
    prev.from_user === curr.from_user &&
    sameDay(prev.sent_datetime, curr.sent_datetime) &&
    new Date(curr.sent_datetime) - new Date(prev.sent_datetime) <= CLUSTER_GAP_MS;
  const sameAsNext =
    next &&
    next.from_user === curr.from_user &&
    sameDay(curr.sent_datetime, next.sent_datetime) &&
    new Date(next.sent_datetime) - new Date(curr.sent_datetime) <= CLUSTER_GAP_MS;

  if (sameAsPrev && sameAsNext) return "middle";
  if (sameAsPrev && !sameAsNext) return "last";
  if (!sameAsPrev && sameAsNext) return "first";
  return "only";
}

export default function MessageList({ messages, currentUserId, conversationId, members, readStatus }) {
  // Pre-compute a cheap lookup so cluster positioning isn't O(n²).
  const memberMap = useMemo(() => {
    const m = new Map();
    (members || []).forEach((u) => m.set(u.id, u));
    return m;
  }, [members]);

  const isGroup = (members?.length || 0) > 2;

  if (!messages?.length) {
    return (
      <div className="text-sm text-gray-500 text-center mt-8">
        No messages yet — say hi 👋
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {messages.map((m, i) => {
        const prev = i > 0 ? messages[i - 1] : null;
        const next = i < messages.length - 1 ? messages[i + 1] : null;

        // Insert a "Today" / "Yesterday" / "Mar 14" divider when the day flips.
        const showDay = !prev || !sameDay(prev.sent_datetime, m.sent_datetime);
        const position = clusterPosition(prev, m, next);
        const isMine = m.from_user === currentUserId;

        // Only show avatar on the *last* bubble in a non-mine cluster (the one
        // with the tail). Only show sender name on the *first* bubble.
        const showAvatar = !isMine && (position === "last" || position === "only");
        const showName  = !isMine && (position === "first" || position === "only");

        const sender = memberMap.get(m.from_user);
        const senderName = sender?.username || sender?.email || "Someone";

        // Read receipts: only relevant on own messages, only the last one in a
        // cluster (Telegram puts the checks once per cluster too).
        let readers = [];
        if (isMine && readStatus && (position === "last" || position === "only")) {
          for (const [userId, lastReadId] of readStatus.entries()) {
            if (userId !== currentUserId && lastReadId === m.message_id) {
              readers.push(userId);
            }
          }
        }

        return (
          <Fragment key={m.message_id}>
            {showDay && <DateDivider dateStr={m.sent_datetime} />}
            <MessageBubble
              msg={m}
              isMine={isMine}
              conversationId={conversationId}
              members={members}
              readers={readers}
              position={position}
              showAvatar={showAvatar}
              showName={showName}
              senderName={senderName}
              isGroup={isGroup}
            />
          </Fragment>
        );
      })}
    </div>
  );
}
