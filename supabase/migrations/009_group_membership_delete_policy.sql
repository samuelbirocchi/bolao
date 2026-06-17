-- Allow global admins to remove members from any group.
-- group_memberships previously had no DELETE policy, so RLS blocked all
-- deletes. This grants global admins the ability to remove a member, while
-- owners are protected at the database level (the application layer also
-- guards against removing owners).
create policy group_memberships_delete_admin
on public.group_memberships for delete
to authenticated
using (public.is_global_admin() and role <> 'owner');
