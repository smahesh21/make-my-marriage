import { NextResponse } from "next/server";

import { createGuest, listGuests } from "@/modules/guests/use-cases";
import { assertSameOrigin } from "@/server/http/request-security";
import { errorResponse, successResponse } from "@/server/http/responses";
import { AppError } from "@/shared/errors";
import {
  createGuestSchema,
  guestListQuerySchema,
} from "@/shared/guests/schemas";
import {
  privateGuestResponse,
  readGuestJson,
  requireGuestContext,
} from "./context";

export async function GET(request: Request) {
  try {
    const context = await requireGuestContext();
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some((key) => params.getAll(key).length > 1))
      throw new AppError("VALIDATION_ERROR", "Use each filter only once.", 400);
    const query = guestListQuerySchema.parse(Object.fromEntries(params));
    return privateGuestResponse(
      NextResponse.json(await listGuests(context.membership.weddingId, query)),
    );
  } catch (error) {
    return privateGuestResponse(errorResponse(error));
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireGuestContext();
    const input = createGuestSchema.parse(await readGuestJson(request));
    return privateGuestResponse(
      successResponse(
        await createGuest(context.membership.weddingId, input),
        201,
      ),
    );
  } catch (error) {
    return privateGuestResponse(errorResponse(error));
  }
}
