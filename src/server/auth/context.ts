import { connectToDatabase } from "@/server/db/mongoose";
import { WeddingMembershipModel } from "@/server/models/wedding-membership";
import { UserModel } from "@/server/models/user";
import { WeddingModel } from "@/server/models/wedding";
import { SessionModel } from "@/server/models/session";

import { getSessionToken, hashSessionToken } from "./session";

export type AuthContext = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  membership: {
    id: string;
    weddingId: string;
    role: "ADMIN" | "MANAGER";
  } | null;
  wedding: {
    id: string;
    brideName: string;
    groomName: string;
    title?: string;
    description?: string;
    weddingDate: string;
    timeZone: string;
    location: {
      city: string;
      formattedAddress?: string;
      state?: string;
      country?: string;
    };
    website: {
      slug: string;
      theme: string;
      isPublished: boolean;
      welcomeMessage?: string;
    };
    gallery: {
      isEnabled: boolean;
      guestUploadsEnabled: boolean;
    };
    livestream: {
      youtubeUrl?: string;
      isEnabled: boolean;
    };
  } | null;
};

export async function getAuthContext(): Promise<AuthContext | null> {
  const token = await getSessionToken();
  if (!token) return null;

  await connectToDatabase();
  const session = await SessionModel.findOne({
    tokenHash: hashSessionToken(token),
    expiresAt: { $gt: new Date() },
  }).lean();

  if (!session) return null;

  const user = await UserModel.findById(session.userId).lean();
  if (!user) return null;

  const membership = await WeddingMembershipModel.findOne({ userId: user._id }).lean();
  if (!membership) {
    return {
      user: { id: user._id.toString(), name: user.name, email: user.email },
      membership: null,
      wedding: null,
    };
  }

  const wedding = await WeddingModel.findOne({ _id: membership.weddingId, deletedAt: null }).lean();
  if (!wedding) {
    return {
      user: { id: user._id.toString(), name: user.name, email: user.email },
      membership: {
        id: membership._id.toString(),
        weddingId: membership.weddingId.toString(),
        role: membership.role as "ADMIN" | "MANAGER",
      },
      wedding: null,
    };
  }

  const website = wedding.website ?? { slug: "", theme: "classic-indian", isPublished: false };
  const gallery = wedding.gallery ?? { isEnabled: false, guestUploadsEnabled: false };
  const livestream = wedding.livestream ?? { isEnabled: false };

  return {
    user: { id: user._id.toString(), name: user.name, email: user.email },
    membership: {
      id: membership._id.toString(),
      weddingId: membership.weddingId.toString(),
      role: membership.role as "ADMIN" | "MANAGER",
    },
    wedding: {
      id: wedding._id.toString(),
      brideName: wedding.brideName,
      groomName: wedding.groomName,
      ...(wedding.title ? { title: wedding.title } : {}),
      ...(wedding.description ? { description: wedding.description } : {}),
      weddingDate: wedding.weddingDate,
      timeZone: wedding.timeZone,
      location: {
        city: wedding.location.city,
        ...(wedding.location.formattedAddress ? { formattedAddress: wedding.location.formattedAddress } : {}),
        ...(wedding.location.state ? { state: wedding.location.state } : {}),
        ...(wedding.location.country ? { country: wedding.location.country } : {}),
      },
      website: {
        slug: website.slug,
        theme: website.theme,
        isPublished: website.isPublished,
        ...(website.welcomeMessage ? { welcomeMessage: website.welcomeMessage } : {}),
      },
      gallery: {
        isEnabled: gallery.isEnabled,
        guestUploadsEnabled: gallery.guestUploadsEnabled,
      },
      livestream: {
        ...(livestream.youtubeUrl ? { youtubeUrl: livestream.youtubeUrl } : {}),
        isEnabled: livestream.isEnabled,
      },
    },
  };
}
