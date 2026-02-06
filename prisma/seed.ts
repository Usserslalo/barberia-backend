import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const SALT_ROUNDS = 10;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL no está definida. Ejecuta el seed con .env configurado.');
}
const adapter = new PrismaPg({ connectionString });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter }) as any;

/** Misma contraseña para admin, barberos y cliente (seed). */
const SEED_PASSWORD = 'Caballeros#2026';
const hashedPassword = bcrypt.hashSync(SEED_PASSWORD, SALT_ROUNDS);

const LANDING_CONFIG_ID = '11111111-1111-1111-1111-111111111111';
const SERVICE_IDS = {
  corteCabello: '22222222-2222-2222-2222-222222222201',
  ritualBarba: '22222222-2222-2222-2222-222222222202',
  exfolianteMascarilla: '22222222-2222-2222-2222-222222222203',
  detalladoCeja: '22222222-2222-2222-2222-222222222204',
  lebronJames: '22222222-2222-2222-2222-222222222205',
  kobeBryant: '22222222-2222-2222-2222-222222222206',
  michaelJordan: '22222222-2222-2222-2222-222222222207',
  lakers: '22222222-2222-2222-2222-222222222208',
  chicagoBulls: '22222222-2222-2222-2222-222222222209',
};
const BARBER_IDS = {
  sergey: '33333333-3333-3333-3333-333333333301',   // inactivo
  matvei: '33333333-3333-3333-3333-333333333302',   // activo Lun-Mie
  evgenii: '33333333-3333-3333-3333-333333333303',  // activo Lun-Vie
};
const CLIENT_ID = '44444444-4444-4444-4444-444444444401';
const APPOINTMENT_IDS = {
  citaMatvei: '550e8400-e29b-41d4-a716-446655440001',
  citaEvgenii: '550e8400-e29b-41d4-a716-446655440002',
};

async function main() {
  console.log('🌱 Iniciando seed — JC BARBER SHOP...');

  // --- 1. ADMIN ---
  await prisma.user.upsert({
    where: { email: 'admin@jcbarbershop.com' },
    create: {
      email: 'admin@jcbarbershop.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'JC Barber Shop',
      phone: '+5217712345678',
      role: 'ADMIN',
      isVerified: true,
    },
    update: {
      firstName: 'Admin',
      lastName: 'JC Barber Shop',
      phone: '+5217712345678',
      role: 'ADMIN',
      isVerified: true,
      password: hashedPassword,
    },
  });
  console.log('✅ Admin: admin@jcbarbershop.com');

  // --- 2. LANDING CONFIG — JC BARBER SHOP, Pachuca ---
  const heroBg = 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1920&q=80';
  const aboutImg = 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80';
  const logoPlaceholder = 'https://images.placeholders.dev/?width=120&height=80&text=JC+BARBER';
  const googleMapsEmbed =
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2227.524031451362!2d-98.7384834243356!3d20.12428529778243!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85d1090b22c2311d%3A0xbabe5f6f2b8d89ef!2sJC%20barbershop!5e0!3m2!1ses-419!2smx!4v1770268522014!5m2!1ses-419!2smx';

  const landingCreate = {
    id: LANDING_CONFIG_ID,
    heroTitle: 'JC BARBER SHOP',
    heroBackgroundImage: heroBg,
    logoUrl: logoPlaceholder,
    aboutTitle: 'Nosotros',
    aboutText:
      'En JC BARBER SHOP creemos que un buen corte y un ritual de barba no son solo un servicio: son una experiencia. ' +
      'Ubicados en el corazón de Pachuca, combinamos técnica, cuidado y un ambiente relajado para que salgas renovado. ' +
      'Todos nuestros servicios incluyen bebida y masaje de cortesía. Te esperamos en C. Manuel Fernando Soto 200, Centro.',
    aboutImageUrl: aboutImg,
    phone: '+52 771 234 5678',
    email: 'contacto@jcbarbershop.com',
    instagramUrl: 'https://www.instagram.com/jcbarbershop',
    whatsappUrl: 'https://wa.me/5217712345678',
    latitude: 20.12428529778243,
    longitude: -98.7384834243356,
    address: 'C. Manuel Fernando Soto 200, Centro, 42000 Pachuca de Soto, Hgo.',
    googleMapsIframe: googleMapsEmbed,
  };

  await prisma.landingConfig.upsert({
    where: { id: LANDING_CONFIG_ID },
    create: landingCreate,
    update: {
      heroTitle: landingCreate.heroTitle,
      heroBackgroundImage: landingCreate.heroBackgroundImage,
      logoUrl: landingCreate.logoUrl,
      aboutTitle: landingCreate.aboutTitle,
      aboutText: landingCreate.aboutText,
      aboutImageUrl: landingCreate.aboutImageUrl,
      phone: landingCreate.phone,
      email: landingCreate.email,
      instagramUrl: landingCreate.instagramUrl,
      whatsappUrl: landingCreate.whatsappUrl,
      latitude: landingCreate.latitude,
      longitude: landingCreate.longitude,
      address: landingCreate.address,
      googleMapsIframe: landingCreate.googleMapsIframe,
    },
  });
  console.log('✅ LandingConfig (JC BARBER SHOP — Pachuca)');

  // --- 3. SERVICIOS Y PAQUETES (JC BARBER SHOP — oficiales) ---
  const services = [
    {
      id: SERVICE_IDS.corteCabello,
      name: 'Corte de cabello',
      description: 'Corte a tu estilo. Incluye bebida y masaje de cortesía.',
      price: 200,
      durationMinutes: 45,
      category: 'Corte',
    },
    {
      id: SERVICE_IDS.ritualBarba,
      name: 'Ritual de barba',
      description: 'Recorte, delineado, vapor y aceite. Incluye bebida y masaje de cortesía.',
      price: 160,
      durationMinutes: 35,
      category: 'Barba',
    },
    {
      id: SERVICE_IDS.exfolianteMascarilla,
      name: 'Exfoliante o mascarilla',
      description: 'Tratamiento facial. Incluye bebida y masaje de cortesía.',
      price: 80,
      durationMinutes: 25,
      category: 'Facial',
    },
    {
      id: SERVICE_IDS.detalladoCeja,
      name: 'Detallado de ceja',
      description: 'Perfilado y definición. Incluye bebida y masaje de cortesía.',
      price: 50,
      durationMinutes: 15,
      category: 'Facial',
    },
    {
      id: SERVICE_IDS.lebronJames,
      name: 'Lebron James',
      description: 'Corte de cabello + Ritual de barba.',
      price: 320,
      durationMinutes: 80,
      category: 'Paquetes',
    },
    {
      id: SERVICE_IDS.kobeBryant,
      name: 'Kobe Bryant',
      description: 'Corte de cabello + Detallado de ceja.',
      price: 230,
      durationMinutes: 60,
      category: 'Paquetes',
    },
    {
      id: SERVICE_IDS.michaelJordan,
      name: 'Michael Jordan',
      description: 'Corte de cabello + Exfoliante o mascarilla.',
      price: 250,
      durationMinutes: 70,
      category: 'Paquetes',
    },
    {
      id: SERVICE_IDS.lakers,
      name: 'Lakers',
      description: 'Corte de cabello + Detallado de ceja + Exfoliante o mascarilla.',
      price: 290,
      durationMinutes: 85,
      category: 'Paquetes',
    },
    {
      id: SERVICE_IDS.chicagoBulls,
      name: 'Chicago Bulls',
      description: 'Corte de cabello + Ritual de barba + Detallado de ceja + Exfoliante y mascarilla.',
      price: 490,
      durationMinutes: 120,
      category: 'Paquetes',
    },
  ];

  for (const s of services) {
    await prisma.service.upsert({
      where: { id: s.id },
      create: s,
      update: s,
    });
  }
  console.log(`✅ ${services.length} servicios y paquetes`);

  // --- 4. CATEGORÍAS Y categoryId EN SERVICIOS ---
  const categories = [
    { name: 'Corte', slug: 'corte' },
    { name: 'Barba', slug: 'barba' },
    { name: 'Facial', slug: 'facial' },
    { name: 'Paquetes', slug: 'paquetes' },
  ];
  const categoryNameToId: Record<string, string> = {};
  for (const c of categories) {
    const cat = await prisma.serviceCategory.upsert({
      where: { slug: c.slug },
      create: { name: c.name, slug: c.slug, isActive: true },
      update: { name: c.name, isActive: true },
    });
    categoryNameToId[c.name] = cat.id;
  }
  for (const s of services) {
    const categoryId = categoryNameToId[s.category];
    if (categoryId) {
      await prisma.service.update({
        where: { id: s.id },
        data: { categoryId },
      });
    }
  }
  console.log('✅ Categorías de servicio');

  // --- 5. BARBEROS (1 inactivo, 2 activos) + USUARIOS BARBER ---
  const barbersConfig = [
    {
      id: BARBER_IDS.sergey,
      name: 'Sergey Trifonov',
      roleDescription: 'Barber Stylist',
      bio: 'Especialista en cortes clásicos. 8 años de experiencia.',
      experienceYears: 8,
      displayOrder: 0,
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
      isActive: false,
      email: 'sergey@example.com',
      phone: '+5215512345671',
    },
    {
      id: BARBER_IDS.matvei,
      name: 'Matvei Efimov',
      roleDescription: 'Barber Stylist',
      bio: 'Degradados y diseños contemporáneos. 6 años.',
      experienceYears: 6,
      displayOrder: 1,
      photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80',
      isActive: true,
      email: 'matvei@example.com',
      phone: '+5215512345672',
    },
    {
      id: BARBER_IDS.evgenii,
      name: 'Evgenii Tarasov',
      roleDescription: 'Barber Stylist',
      bio: 'Precisión y detalle. Barbas y bigotes. 5 años.',
      experienceYears: 5,
      displayOrder: 2,
      photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80',
      isActive: true,
      email: 'evgenii@example.com',
      phone: '+5215512345673',
    },
  ];

  for (const b of barbersConfig) {
    const { email, phone, isActive, ...barberData } = b;
    await prisma.barber.upsert({
      where: { id: barberData.id },
      create: {
        id: barberData.id,
        name: barberData.name,
        roleDescription: barberData.roleDescription,
        bio: barberData.bio ?? null,
        photoUrl: barberData.photoUrl ?? null,
        experienceYears: barberData.experienceYears ?? 0,
        displayOrder: barberData.displayOrder ?? 0,
        isActive,
      },
      update: {
        name: barberData.name,
        roleDescription: barberData.roleDescription,
        bio: barberData.bio ?? null,
        photoUrl: barberData.photoUrl ?? null,
        experienceYears: barberData.experienceYears ?? 0,
        displayOrder: barberData.displayOrder ?? 0,
        isActive,
      },
    });
    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        phone,
        password: hashedPassword,
        firstName: barberData.name.split(' ')[0] ?? barberData.name,
        lastName: barberData.name.split(' ').slice(1).join(' ') || null,
        role: 'BARBER',
        barberId: barberData.id,
        isVerified: true,
      },
      update: {
        phone,
        password: hashedPassword,
        firstName: barberData.name.split(' ')[0] ?? barberData.name,
        lastName: barberData.name.split(' ').slice(1).join(' ') || null,
        role: 'BARBER',
        barberId: barberData.id,
        isVerified: true,
      },
    });
  }
  console.log('✅ 3 barberos (1 inactivo, 2 activos)');

  // --- 6. HORARIOS: Sergey Lun-Vie; Matvei solo Lun-Mie; Evgenii Lun-Vie ---
  const defaultSchedule = { startTime: '09:00', endTime: '18:00', breakStart: '14:00', breakEnd: '15:00', isActive: true };

  for (const dayOfWeek of [1, 2, 3, 4, 5]) {
    await prisma.barberWorkSchedule.upsert({
      where: { barberId_dayOfWeek: { barberId: BARBER_IDS.sergey, dayOfWeek } },
      create: { barberId: BARBER_IDS.sergey, dayOfWeek, ...defaultSchedule },
      update: defaultSchedule,
    });
  }
  for (const dayOfWeek of [1, 2, 3]) {
    await prisma.barberWorkSchedule.upsert({
      where: { barberId_dayOfWeek: { barberId: BARBER_IDS.matvei, dayOfWeek } },
      create: { barberId: BARBER_IDS.matvei, dayOfWeek, ...defaultSchedule },
      update: defaultSchedule,
    });
  }
  await prisma.barberWorkSchedule.deleteMany({
    where: { barberId: BARBER_IDS.matvei, dayOfWeek: { in: [4, 5] } },
  });
  for (const dayOfWeek of [1, 2, 3, 4, 5]) {
    await prisma.barberWorkSchedule.upsert({
      where: { barberId_dayOfWeek: { barberId: BARBER_IDS.evgenii, dayOfWeek } },
      create: { barberId: BARBER_IDS.evgenii, dayOfWeek, ...defaultSchedule },
      update: defaultSchedule,
    });
  }
  console.log('✅ Horarios: Sergey Lun-Vie; Matvei Lun-Mie; Evgenii Lun-Vie');

  // --- 7. CLIENTE (USER) ---
  await prisma.user.upsert({
    where: { email: 'cliente@example.com' },
    create: {
      id: CLIENT_ID,
      email: 'cliente@example.com',
      password: hashedPassword,
      firstName: 'Roberto',
      lastName: 'Cliente',
      phone: '+5215512345699',
      role: 'USER',
      isVerified: true,
    },
    update: {
      firstName: 'Roberto',
      lastName: 'Cliente',
      phone: '+5215512345699',
      password: hashedPassword,
      isVerified: true,
    },
  });
  const client = await prisma.user.findUnique({ where: { email: 'cliente@example.com' } });
  if (!client) throw new Error('Cliente no creado');
  console.log('✅ Cliente: cliente@example.com');

  // --- 8. CITAS (cliente con cada barbero activo; fechas >= 2026-02-03) ---
  const today = new Date('2026-02-03T12:00:00.000Z');
  const citaMatveiDate = new Date(today);
  citaMatveiDate.setUTCHours(10, 0, 0, 0);
  const citaEvgeniiDate = new Date(today);
  citaEvgeniiDate.setUTCDate(citaEvgeniiDate.getUTCDate() + 1);
  citaEvgeniiDate.setUTCHours(11, 0, 0, 0);

  await prisma.appointment.upsert({
    where: { id: APPOINTMENT_IDS.citaMatvei },
    create: {
      id: APPOINTMENT_IDS.citaMatvei,
      userId: client.id,
      barberId: BARBER_IDS.matvei,
      serviceId: SERVICE_IDS.corteCabello,
      date: citaMatveiDate,
      status: 'PENDING',
      notes: null,
    },
    update: {
      userId: client.id,
      barberId: BARBER_IDS.matvei,
      serviceId: SERVICE_IDS.corteCabello,
      date: citaMatveiDate,
      status: 'PENDING',
    },
  });
  await prisma.appointment.upsert({
    where: { id: APPOINTMENT_IDS.citaEvgenii },
    create: {
      id: APPOINTMENT_IDS.citaEvgenii,
      userId: client.id,
      barberId: BARBER_IDS.evgenii,
      serviceId: SERVICE_IDS.lebronJames,
      date: citaEvgeniiDate,
      status: 'ACCEPTED',
      notes: null,
    },
    update: {
      userId: client.id,
      barberId: BARBER_IDS.evgenii,
      serviceId: SERVICE_IDS.lebronJames,
      date: citaEvgeniiDate,
      status: 'ACCEPTED',
    },
  });
  console.log('✅ 2 citas (cliente con Matvei y Evgenii; fechas desde 03/02/26)');

  console.log('');
  console.log('🏁 Seed completado — JC BARBER SHOP');
  console.log('   Contraseña para TODOS: ' + SEED_PASSWORD);
  console.log('   Admin:     admin@jcbarbershop.com');
  console.log('   Barberos:  sergey@example.com (inactivo), matvei@example.com (Lun-Mie), evgenii@example.com (Lun-Vie)');
  console.log('   Cliente:   cliente@example.com');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
