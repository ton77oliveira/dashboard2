import { StatusBadge } from './StatusBadge.jsx';

const sortOptions = [
  { value: 'session', label: 'Sessoes recentes' },
  { value: 'name', label: 'Nome' },
  { value: 'modified', label: 'Alteracao' },
  { value: 'created', label: 'Criacao' },
];

export function ProjectTable({ projects, sortMode, onSortModeChange }) {
  return (
    <section className="projects-panel">
      <header>
        <div>
          <h2>Projetos</h2>
          <span>{projects.length} diretorios</span>
        </div>
        <div className="sort-controls" aria-label="Ordenar projetos">
          {sortOptions.map((option) => (
            <button className={sortMode === option.value ? 'active' : ''} key={option.value} onClick={() => onSortModeChange(option.value)} type="button">
              {option.label}
            </button>
          ))}
        </div>
      </header>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Projeto</th>
              <th>Status</th>
              <th>Fase</th>
              <th>Progresso</th>
              <th>Komodo</th>
              <th>Publicacao</th>
              <th>Dominios</th>
              <th>SDD</th>
              <th>OpenCode</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.path}>
                <td data-label="Projeto"><strong>{project.name}</strong><small>{project.path || 'fonte: Komodo'}</small></td>
                <td data-label="Status">{project.status?.state || 'nao informado'}</td>
                <td data-label="Fase">{project.status?.phase || '-'}</td>
                <td data-label="Progresso">{project.status?.progress === null || project.status?.progress === undefined ? '-' : `${project.status.progress}%`}</td>
                <td data-label="Komodo"><StatusBadge value={Boolean(project.komodo?.linked)} /></td>
                <td data-label="Publicacao"><StatusBadge value={project.komodo?.publication?.state || 'idle'} /></td>
                <td data-label="Dominios">{project.komodo?.domains?.length ? project.komodo.domains.map((domain) => <a key={domain} className="domain-link" href={`https://${domain}`} target="_blank" rel="noreferrer">{domain}</a>) : '-'}</td>
                <td data-label="SDD">{project.sdd ? `${project.sdd.specs.total} specs / ${project.sdd.specs.pending + project.sdd.tasks.pending} pend.` : '-'}</td>
                <td data-label="OpenCode">{project.opencode?.link ? <a href={project.opencode.link} target="_blank" rel="noreferrer"><StatusBadge value={project.opencode?.state || 'idle'} /></a> : <StatusBadge value={project.opencode?.state || 'idle'} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
