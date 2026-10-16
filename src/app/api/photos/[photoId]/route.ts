import { deletePhoto } from "@/modules/photos/use-cases";
import { assertSameOrigin } from "@/server/http/request-security";
import { errorResponse, successResponse } from "@/server/http/responses";
import { privatePhotoResponse, requirePhotoContext } from "../context";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ photoId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { membership } = await requirePhotoContext();
    return privatePhotoResponse(
      successResponse(
        await deletePhoto(membership.weddingId, (await params).photoId),
      ),
    );
  } catch (error) {
    return privatePhotoResponse(errorResponse(error));
  }
}
