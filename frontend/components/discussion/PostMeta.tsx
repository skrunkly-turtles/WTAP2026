import { Lock, ShieldCheck, VenetianMask } from "lucide-react";
import type { Post } from "@/lib/api";
import { PROGRAM_LABEL, timeAgo, titleCase } from "@/lib/format";
import { Badge } from "../ui";

export function AuthorLine({ author, anonymity, isAdminAuthor, createdAt, revealed }: {
  author: { name: string; program: string | null } | null; anonymity: string; isAdminAuthor?: boolean; createdAt: string; revealed?: boolean;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
      {author ? (
        <>
          <span className="font-medium text-ink">{author.name}</span>
          {isAdminAuthor ? <Badge tone="brand"><ShieldCheck className="h-3 w-3" />HR / Admin</Badge>
            : author.program && <span>· {PROGRAM_LABEL[author.program]}</span>}
          {revealed && <Badge tone="accent">Revealed</Badge>}
        </>
      ) : anonymity === "anonymous" ? (
        <span className="inline-flex items-center gap-1 font-medium text-ink"><VenetianMask className="h-3.5 w-3.5" />Anonymous</span>
      ) : null}
      <span>· {timeAgo(createdAt)}</span>
    </span>
  );
}

export function PostBadges({ post }: { post: Post }) {
  return (
    <span className="flex flex-wrap gap-1">
      <Badge>{titleCase(post.category)}</Badge>
      {post.audience === "admins_only" && <Badge tone="accent"><Lock className="h-3 w-3" />Admins only</Badge>}
    </span>
  );
}
