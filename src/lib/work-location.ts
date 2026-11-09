import { z } from "zod";

export const personLocationIds = z.array(z.string().uuid()).max(1, "Choose only one work location");