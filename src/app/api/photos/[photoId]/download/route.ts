import { downloadPhoto } from "@/modules/photos/use-cases";
import { errorResponse, successResponse } from "@/server/http/responses";
import { privatePhotoResponse, requirePhotoContext } from "../../context";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ photoId: string }> },
) {
  try {
    const { membership } = await requirePhotoContext();
    return privatePhotoResponse(
      successResponse(
        await downloadPhoto(membership.weddingId, (await params).photoId),
      ),
    );
  } catch (error) {
    return privatePhotoResponse(errorResponse(error));
  }
}
