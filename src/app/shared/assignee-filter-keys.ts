/**
 * localStorage keys under which the Tasks and Tickets pages remember their "assigned to" filter.
 * Shared so other screens (the dashboard greeting) can open those pages already narrowed to the
 * signed-in user.
 */
export const TASK_ASSIGNEE_FILTER_KEY = 'bento_task_assignee_filter';
export const TICKET_ASSIGNEE_FILTER_KEY = 'bento_ticket_assignee_filter';
