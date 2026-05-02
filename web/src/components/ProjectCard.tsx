import { Link } from "react-router-dom";
import type { Project } from "../lib/firestore";

interface Props {
  project: Project & { id: string };
}

function formatDate(ts: { seconds: number } | null): string {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ProjectCard({ project }: Props) {
  const isActive = project.status === "active";

  return (
    <Link
      to={`/projects/${project.id}`}
      className="card block hover:bg-surface-container-low transition-colors"
    >
      <div className="flex items-start justify-between gap-md">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-sm flex-wrap">
            <span className="text-h2 text-on-surface">{project.name}</span>
            <span
              className={`status-badge text-body-sm ${
                isActive
                  ? "bg-primary-container text-on-primary"
                  : "bg-secondary-container text-on-secondary-container"
              }`}
            >
              {isActive ? "Active" : "Closed"}
            </span>
          </div>

          <p className="mt-xs text-body-md text-on-surface-variant">
            {project.address}
            {project.zipCode ? ` · ${project.zipCode}` : ""}
          </p>

          {(project.startDate || project.endDate) && (
            <p className="mt-xs text-body-sm text-on-surface-variant">
              {formatDate(project.startDate)} – {formatDate(project.endDate)}
            </p>
          )}
        </div>
      </div>

      {project.description && (
        <p className="mt-sm text-body-sm text-on-surface-variant line-clamp-2">
          {project.description}
        </p>
      )}
    </Link>
  );
}
