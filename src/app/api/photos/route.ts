import { confirmPhotoUpload, listPhotos } from "@/modules/photos/use-cases";
import { assertSameOrigin } from "@/server/http/request-security";
import { errorResponse, successResponse } from "@/server/http/responses";
import {
  photoConfirmationSchema,
  photoListSchema,
} from "@/shared/photos/schemas";
import {
  privatePhotoResponse,
  readPhotoJson,
  requirePhotoContext,
} from "./context";

export async function GET(request: Request) {
  try {
    const { membership } = await requirePhotoContext();
    const query = photoListSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return privatePhotoResponse(
      Response.json(await listPhotos(membership.weddingId, query)),
    );
  } catch (error) {
    return privatePhotoResponse(errorResponse(error));
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { membership } = await requirePhotoContext();
    const input = photoConfirmationSchema.parse(await readPhotoJson(request));
    return privatePhotoResponse(
      successResponse(
        await confirmPhotoUpload(membership.weddingId, membership.id, input),
        201,
      ),
    );
  } catch (error) {
    return privatePhotoResponse(errorResponse(error));
  }
}
