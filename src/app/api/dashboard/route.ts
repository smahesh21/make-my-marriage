import { AppError } from "@/shared/errors";
import { getAuthContext } from "@/server/auth/context";
import { errorResponse, successResponse } from "@/server/http/responses";
import { listWeddingEvents } from "@/modules/events/use-cases";
import { getWeddingTaskDashboard } from "@/modules/tasks/use-cases";
import { getGuestSummary } from "@/modules/guests/use-cases";

export async function GET() {
  try {
    const context = await getAuthContext();
    if (!context) throw new AppError("UNAUTHORIZED", "Authentication is required.", 401);
    if (!context.wedding || !context.membership) throw new AppError("WEDDING_NOT_FOUND", "Create a wedding workspace to continue.", 404);

    const weddingDate = new Date(`${context.wedding.weddingDate}T00:00:00.000Z`);
    const today = new Date();
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const weddingUtc = Date.UTC(weddingDate.getUTCFullYear(), weddingDate.getUTCMonth(), weddingDate.getUTCDate());
    const [events, taskDashboard, guests] = await Promise.all([
      listWeddingEvents(context.membership?.weddingId ?? "", { includeArchived: false }),
      getWeddingTaskDashboard(context.membership?.weddingId ?? "", context.membership?.id ?? ""),
      getGuestSummary(context.membership.weddingId),
    ]);
    const upcomingEvents = events.filter((event) => new Date(event.startsAt).getTime() >= Date.now()).slice(0, 3);

    return successResponse({
      wedding: context.wedding,
      membership: context.membership,
      countdown: {
        weddingDate: context.wedding.weddingDate,
        daysRemaining: Math.max(0, Math.ceil((weddingUtc - todayUtc) / 86_400_000)),
      },
      summary: {
        events: events.length,
        tasks: {
          total: taskDashboard.summary.total,
          completed: taskDashboard.summary.completed,
          dueSoon: taskDashboard.summary.dueSoon,
          assignedToCurrent: taskDashboard.summary.assignedToCurrent,
        },
        guests: guests.totalGuests,
        guestCapacity: guests.totalGuestCapacity,
        peopleAttending: guests.totalPeopleAttending,
        rsvps: { pending: guests.pendingInvitations, attending: guests.attendingInvitations, notAttending: guests.notAttendingInvitations },
        totalExpensePaise: 0,
        vendors: 0,
      },
      upcomingEvents,
      upcomingTasks: taskDashboard.upcomingTasks,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
