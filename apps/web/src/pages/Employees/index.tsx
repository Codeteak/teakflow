import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  DEPARTMENTS,
  DESIGNATIONS,
  ROLES,
  USER_STATUS,
  CONVERSATION_TYPE,
  departmentOrder,
  reportsToCandidates,
  reportsToLabel,
  type CreateUserInput,
  type PublicUser,
  type Role,
} from '@teakflow/shared';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorBanner, PageLoading } from '@/components/ui/page-state';
import { Input } from '@/components/ui/input';
import { RightPanel } from '@/components/ui/right-panel';
import { Select } from '@/components/ui/select';
import { createUserRequest, listUsersRequest, updateUserRequest } from '@/features/employees/api';
import { createConversationRequest } from '@/features/chat/api';
import { uploadFileRequest } from '@/features/files/api';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/auth';

const emptyForm: CreateUserInput = {
  name: '',
  email: '',
  password: '',
  designation: 'Frontend Developer',
  department: 'Engineering',
  role: ROLES.EMPLOYEE,
  avatar: null,
  managerId: null,
  headedDepartments: [],
  extraDesignations: [],
};

const roleLabels: Record<Role, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  LEAD: 'Lead',
  EMPLOYEE: 'Employee',
};

function roleBadgeTone(role: Role) {
  if (role === ROLES.ADMIN) return 'sage' as const;
  if (role === ROLES.MANAGER) return 'amber' as const;
  if (role === ROLES.LEAD) return 'amber' as const;
  return 'neutral' as const;
}

function needsReportsTo(role: Role) {
  return role === ROLES.LEAD || role === ROLES.EMPLOYEE;
}

export function EmployeesPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';
  const session = useAuthStore((state) => state.user);
  const isAdmin = session?.role === ROLES.ADMIN;
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [form, setForm] = useState<CreateUserInput>(emptyForm);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<(typeof USER_STATUS)[keyof typeof USER_STATUS]>(USER_STATUS.ACTIVE);
  const [deptFilter, setDeptFilter] = useState('all');
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    listUsersRequest()
      .then((users) => {
        if (!cancelled) {
          setPeople(users);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Unable to load employees.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const namesById = useMemo(() => new Map(people.map((person) => [person.id, person.name])), [people]);

  function assignChoices(
    role: Role,
    department: string | null | undefined,
    excludeId?: string,
    currentId?: string | null,
  ) {
    const list = reportsToCandidates(people, role, department, excludeId);
    if (currentId && !list.some((person) => person.id === currentId)) {
      const current = people.find((person) => person.id === currentId);
      if (current) {
        return [current, ...list];
      }
    }
    return list;
  }

  const priorityDepartments =
    session?.role === ROLES.MANAGER
      ? (session.headedDepartments ?? [])
      : session?.department
        ? [session.department]
        : [];

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return people;
    }
    return people.filter((person) =>
      [
        person.name,
        person.email,
        person.designation,
        person.department,
        person.role,
        person.companyId,
        ...(person.extraDesignations ?? []),
        ...(person.headedDepartments ?? []),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [people, query]);

  const groups = useMemo(() => {
    const rows = deptFilter === 'all' ? visible : visible.filter((person) => person.department === deptFilter);
    const order = departmentOrder(priorityDepartments);
    const map = new Map<string, PublicUser[]>();
    for (const key of order) {
      map.set(key, []);
    }
    for (const person of rows) {
      const key = person.department && map.has(person.department) ? person.department : 'Other';
      map.get(key)?.push(person);
    }
    return order
      .map((label) => ({ label, people: map.get(label) ?? [] }))
      .filter((group) => group.people.length > 0);
  }, [deptFilter, priorityDepartments, visible]);

  function closePanel() {
    setPanelOpen(false);
    setEditingId(null);
    setStatus(USER_STATUS.ACTIVE);
    setFormError('');
    setForm(emptyForm);
    if (photoRef.current) {
      photoRef.current.value = '';
    }
  }

  function openCreate() {
    setEditingId(null);
    setStatus(USER_STATUS.ACTIVE);
    setFormError('');
    setForm(emptyForm);
    setPanelOpen(true);
  }

  function openEdit(person: PublicUser) {
    setEditingId(person.id);
    setStatus(person.status);
    setFormError('');
    setForm({
      ...emptyForm,
      name: person.name,
      email: person.email,
      password: '',
      designation: (person.designation as CreateUserInput['designation']) || emptyForm.designation,
      department: (person.department as CreateUserInput['department']) || emptyForm.department,
      role: person.role,
      avatar: person.avatar,
      managerId: person.managerId,
      headedDepartments: person.headedDepartments ?? [],
      extraDesignations: person.extraDesignations ?? [],
    });
    setPanelOpen(true);
  }

  async function onPhoto(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      return;
    }
    setFormError('');
    setUploadingPhoto(true);
    try {
      const stored = await uploadFileRequest(file, 'avatars');
      setForm((current) => ({ ...current, avatar: stored.url }));
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not upload the photo.');
    } finally {
      setUploadingPhoto(false);
      if (photoRef.current) {
        photoRef.current.value = '';
      }
    }
  }

  async function onRestrict(person: PublicUser) {
    if (session && person.id === session.id) {
      setError('You cannot restrict your own account.');
      return;
    }
    const confirmed = window.confirm(
      `Restrict ${person.name} from the company? They will be signed out and cannot log in until restored.`,
    );
    if (!confirmed) {
      return;
    }
    try {
      const updated = await updateUserRequest(person.id, { status: USER_STATUS.INACTIVE });
      setPeople((current) => current.map((row) => (row.id === updated.id ? updated : row)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to restrict that person.');
    }
  }

  async function onRestore(person: PublicUser) {
    try {
      const updated = await updateUserRequest(person.id, { status: USER_STATUS.ACTIVE });
      setPeople((current) => current.map((row) => (row.id === updated.id ? updated : row)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to restore that person.');
    }
  }

  async function onAssignManager(personId: string, managerId: string) {
    try {
      const updated = await updateUserRequest(personId, { managerId: managerId || null });
      setPeople((current) => current.map((person) => (person.id === updated.id ? updated : person)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to assign manager.');
    }
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setPending(true);
    try {
      if (editingId) {
        const updated = await updateUserRequest(editingId, {
          name: form.name,
          designation: form.designation,
          department: form.department,
          role: form.role,
          avatar: form.avatar,
          managerId: form.managerId,
          headedDepartments: form.headedDepartments,
          extraDesignations: form.extraDesignations,
          status,
        });
        setPeople((current) => current.map((person) => (person.id === updated.id ? updated : person)));
      } else {
        const created = await createUserRequest(form);
        setPeople((current) =>
          [...current, created].sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email)),
        );
      }
      closePanel();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : editingId ? 'Unable to update employee.' : 'Unable to create employee.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex shrink-0 items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Employees</h1>
          <p className="mt-1 text-sm text-muted">
            People are grouped by department. Assign reports-to from that department’s manager or lead.
          </p>
        </div>
        {isAdmin ? (
          <Button type="button" onClick={openCreate}>
            Add person
          </Button>
        ) : null}
      </header>

      {error ? <ErrorBanner message={error} /> : null}

      {loading ? (
        <PageLoading rows={4} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(
                'h-8 rounded-md border px-3 text-xs font-medium',
                deptFilter === 'all' ? 'border-sage bg-sage-soft text-sage' : 'border-line bg-surface text-muted',
              )}
              onClick={() => setDeptFilter('all')}
            >
              All
            </button>
            {departmentOrder(priorityDepartments)
              .filter((label) => label !== 'Other')
              .map((department) => (
                <button
                  key={department}
                  type="button"
                  className={cn(
                    'h-8 rounded-md border px-3 text-xs font-medium',
                    deptFilter === department ? 'border-sage bg-sage-soft text-sage' : 'border-line bg-surface text-muted',
                  )}
                  onClick={() => setDeptFilter(department)}
                >
                  {department}
                </button>
              ))}
          </div>
          {groups.length === 0 ? (
            <EmptyState title="No people match that search" description="Try another name or clear the filter." />
          ) : (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto scrollbar-none">
              {groups.map((group) => (
                <section key={group.label} className="overflow-hidden rounded-lg border border-line bg-surface">
                  <h2 className="border-b border-line px-4 py-2 text-xs font-medium tracking-wide text-muted uppercase">
                    {group.label}
                    <span className="ml-2 font-normal normal-case">· {group.people.length}</span>
                  </h2>
                  <div className="divide-y divide-line">
                    {group.people.map((person) => (
              <div key={person.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={person.name} src={person.avatar} size={40} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{person.name}</p>
                    <p className="text-xs text-muted">
                      {person.companyId ? `${person.companyId} · ` : ''}
                      {person.designation ?? 'No title'}
                      {person.department ? ` · ${person.department}` : ''}
                      {person.managerId && namesById.get(person.managerId)
                        ? ` · Reports to ${namesById.get(person.managerId)}`
                        : ''}
                      {person.extraDesignations?.length
                        ? ` · Also ${person.extraDesignations.join(', ')}`
                        : ''}
                      {person.role === ROLES.MANAGER && person.headedDepartments?.length
                        ? ` · Heads ${person.headedDepartments.join(', ')}`
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isAdmin && needsReportsTo(person.role) ? (
                    <label className="flex items-center gap-2">
                      <span className="text-xs text-muted">Reports to</span>
                      <Select
                        className="w-56"
                        value={person.managerId ?? ''}
                        onChange={(event) => void onAssignManager(person.id, event.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {assignChoices(person.role, person.department, person.id, person.managerId).map((boss) => (
                          <option key={boss.id} value={boss.id}>
                            {reportsToLabel(boss)}
                          </option>
                        ))}
                      </Select>
                    </label>
                  ) : null}
                  {session && person.id !== session.id ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate(`/meetings?with=${person.id}`)}
                      >
                        Create meeting
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          void createConversationRequest({
                            type: CONVERSATION_TYPE.DIRECT,
                            userId: person.id,
                          }).then((conversation) => navigate(`/chat/${conversation.id}`));
                        }}
                      >
                        Message
                      </Button>
                    </>
                  ) : null}
                  <Badge tone={roleBadgeTone(person.role)}>
                    {roleLabels[person.role]}
                  </Badge>
                  {person.status === USER_STATUS.INACTIVE ? <Badge tone="rose">Restricted</Badge> : null}
                  {isAdmin && person.id !== session?.id && person.status === USER_STATUS.ACTIVE ? (
                    <Button type="button" variant="outline" onClick={() => void onRestrict(person)}>
                      Delete
                    </Button>
                  ) : null}
                  {isAdmin && person.status === USER_STATUS.INACTIVE ? (
                    <Button type="button" variant="outline" onClick={() => void onRestore(person)}>
                      Restore
                    </Button>
                  ) : null}
                  {isAdmin ? (
                    <Button type="button" variant="outline" onClick={() => openEdit(person)}>
                      Edit
                    </Button>
                  ) : null}
                </div>
              </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {isAdmin ? (
        <RightPanel open={panelOpen} title={editingId ? 'Edit person' : 'Add person'} onClose={closePanel}>
          <form className="flex flex-col gap-3" onSubmit={onSave}>
            <div className="flex items-center gap-3">
              <Avatar name={form.name || 'New'} src={form.avatar} size={56} />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted">Profile photo</p>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={(event) => void onPhoto(event.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingPhoto || pending}
                  onClick={() => photoRef.current?.click()}
                >
                  {uploadingPhoto ? 'Uploading…' : form.avatar ? 'Change photo' : 'Upload photo'}
                </Button>
              </div>
            </div>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted">Name</span>
              <Input
                placeholder="Name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted">Email</span>
              <Input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                required
                disabled={Boolean(editingId)}
              />
            </label>
            {editingId ? null : (
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted">Temporary password</span>
              <Input
                type="password"
                placeholder="Temporary password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                required
                minLength={8}
              />
            </label>
            )}
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted">Role</span>
              <Select
                value={form.role}
                onChange={(event) => {
                  const role = event.target.value as Role;
                  setForm((current) => ({
                    ...current,
                    role,
                    managerId: needsReportsTo(role) ? current.managerId : null,
                    headedDepartments: role === ROLES.MANAGER ? current.headedDepartments : [],
                  }));
                }}
              >
                {Object.values(ROLES).map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role]}
                  </option>
                ))}
              </Select>
            </label>
            {needsReportsTo(form.role) ? (
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted">Reports to</span>
                <Select
                  value={form.managerId ?? ''}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, managerId: event.target.value || null }))
                  }
                >
                  <option value="">Unassigned</option>
                  {assignChoices(form.role, form.department, editingId ?? undefined, form.managerId).map((boss) => (
                    <option key={boss.id} value={boss.id}>
                      {reportsToLabel(boss)}
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted">Position</span>
              <Select
                value={form.designation}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    designation: event.target.value as CreateUserInput['designation'],
                  }))
                }
              >
                {DESIGNATIONS.map((title) => (
                  <option key={title} value={title}>
                    {title}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted">Department</span>
              <Select
                value={form.department}
                onChange={(event) =>
                  setForm((current) => {
                    const department = event.target.value as CreateUserInput['department'];
                    const stillValid = reportsToCandidates(people, current.role, department, editingId ?? undefined).some(
                      (boss) => boss.id === current.managerId,
                    );
                    return {
                      ...current,
                      department,
                      managerId: stillValid ? current.managerId : null,
                    };
                  })
                }
              >
                {DEPARTMENTS.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </Select>
            </label>
            {form.role === ROLES.MANAGER ? (
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-muted">Heads departments</legend>
                <p className="text-xs text-muted">One manager per department. A manager may head several.</p>
                <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-line p-2">
                  {DEPARTMENTS.map((department) => {
                    const checked = (form.headedDepartments ?? []).includes(department);
                    return (
                      <label key={department} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-sage"
                          checked={checked}
                          onChange={() =>
                            setForm((current) => {
                              const list = current.headedDepartments ?? [];
                              return {
                                ...current,
                                headedDepartments: checked
                                  ? list.filter((item) => item !== department)
                                  : [...list, department],
                              };
                            })
                          }
                        />
                        {department}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-muted">Extra titles</legend>
              <p className="text-xs text-muted">Additional designations on this login. Not extra accounts.</p>
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-line p-2">
                {DESIGNATIONS.filter((title) => title !== form.designation).map((title) => {
                  const checked = (form.extraDesignations ?? []).includes(title);
                  return (
                    <label key={title} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-sage"
                        checked={checked}
                        onChange={() =>
                          setForm((current) => {
                            const list = current.extraDesignations ?? [];
                            return {
                              ...current,
                              extraDesignations: checked
                                ? list.filter((item) => item !== title)
                                : [...list, title],
                            };
                          })
                        }
                      />
                      {title}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {editingId ? (
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted">Status</span>
                <Select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as (typeof USER_STATUS)[keyof typeof USER_STATUS])
                  }
                >
                  <option value={USER_STATUS.ACTIVE}>Active</option>
                  <option value={USER_STATUS.INACTIVE}>Restricted</option>
                </Select>
              </label>
            ) : null}
            {formError ? <p className="text-sm text-rose">{formError}</p> : null}
            <Button className="mt-2 w-full" type="submit" disabled={pending || uploadingPhoto}>
              {pending ? (editingId ? 'Saving…' : 'Creating…') : editingId ? 'Save' : 'Create'}
            </Button>
          </form>
        </RightPanel>
      ) : null}
    </div>
  );
}
