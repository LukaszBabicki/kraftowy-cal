-- CreateTable
CREATE TABLE "BookingPrivateNote" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingPrivateNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingPrivateNote_userId_idx" ON "BookingPrivateNote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingPrivateNote_bookingId_userId_key" ON "BookingPrivateNote"("bookingId", "userId");

-- AddForeignKey
ALTER TABLE "BookingPrivateNote" ADD CONSTRAINT "BookingPrivateNote_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingPrivateNote" ADD CONSTRAINT "BookingPrivateNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
