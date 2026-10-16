import { createPhotoUpload } from "@/modules/photos/use-cases";
import { assertSameOrigin } from "@/server/http/request-security";
import { errorResponse, successResponse } from "@/server/http/responses";
import { photoUploadSchema } from "@/shared/photos/schemas";
import {
  privatePhotoResponse,
  readPhotoJson,
  requirePhotoContext,
} from "../context";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { membership } = await requirePhotoContext();
    const input = photoUploadSchema.parse(await readPhotoJson(request));
    return privatePhotoResponse(
      successResponse(
        await createPhotoUpload(
          membership.weddingId,
          membership.id,
          input,
          request,
        ),
        201,
      ),
    );
  } catch (error) {
    return privatePhotoResponse(errorResponse(error));
  }
}
