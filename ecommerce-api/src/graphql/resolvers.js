const db_gql = require("../config/database");
const jwt_gql = require("jsonwebtoken");

module.exports = {
  products: async ({
    search,
    categoryId,
    onSale,
    sortBy,
    page = 1,
    limit = 12,
  }) => {
    const offset = (page - 1) * limit;

    let whereClauses = ["p.stock > 0"];
    const params = [];

    if (search) {
      whereClauses.push("p.name LIKE ?");
      params.push(`%${search}%`);
    }
    if (categoryId) {
      whereClauses.push("p.category_id = ?");
      params.push(categoryId);
    }
    if (onSale) {
      whereClauses.push("p.discount_price IS NOT NULL");
    }

    const whereString =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // Lógica de Ordenação
    let orderByString = "ORDER BY p.created_at DESC";
    if (sortBy === "rating_desc") {
      orderByString = "ORDER BY p.rating DESC";
    }

    const countSql = `SELECT COUNT(*) as totalCount FROM products p ${whereString}`;
    const [countRows] = await db_gql.query(countSql, params);
    const totalPages = Math.ceil(countRows[0].totalCount / limit);

    const sql = `
        SELECT p.*, c.name as category_name, c.image_url as category_image_url
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ${whereString}
        ${orderByString}
        LIMIT ? OFFSET ?
    `;
    const finalParams = [...params, limit, offset];

    const [products] = await db_gql.query(sql, finalParams);

    return {
      products: products.map((p) => ({
        ...p,
        category: p.category_id
          ? {
              id: p.category_id,
              name: p.category_name,
              image_url: p.category_image_url,
            }
          : null,
      })),
      totalPages,
    };
  },
  product: async ({ id }) => {
    const sql = `
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `;
    const [rows] = await db_gql.query(sql, [id]);
    if (rows.length === 0) return null;

    const p = rows[0];
    return {
      ...p,
      category: { name: p.category_name },
    };
  },
  categories: async () => {
    const [categories] = await db_gql.query("SELECT * FROM categories");
    const [products] = await db_gql.query(
      "SELECT id, name, category_id FROM products WHERE stock > 0"
    );

    const categoryMap = new Map();
    categories.forEach((cat) => {
      categoryMap.set(cat.id, { ...cat, products: [] });
    });

    products.forEach((prod) => {
      if (prod.category_id && categoryMap.has(prod.category_id)) {
        categoryMap.get(prod.category_id).products.push(prod);
      }
    });

    return {
      categories: Array.from(categoryMap.values()),
      totalPages: 1, // ou calcule corretamente se necessário
    };
  },
  users: async ({ page = 1, limit = 15 }, context) => {
    if (!context.user || context.user.role !== "admin") {
      throw new Error("Acesso negado. Requer privilégios de administrador.");
    }
    const offset = (page - 1) * limit;
    const [countRows] = await db_gql.query(
      "SELECT COUNT(*) as totalCount FROM users"
    );
    const totalPages = Math.ceil(countRows[0].totalCount / limit);
    const [users] = await db_gql.query(
      "SELECT id, name, username, role, created_at FROM users LIMIT ? OFFSET ?",
      [limit, offset]
    );
    return { users, totalPages };
  },
  profile: async (args, context) => {
    if (!context.user) throw new Error("Não autenticado.");
    const [users] = await db_gql.query(
      "SELECT id, name, age, city, state, username, role, created_at FROM users WHERE id = ?",
      [context.user.id]
    );
    if (users.length === 0) throw new Error("Usuário não encontrado.");
    return users[0];
  },
  orders: async (args, context) => {
    if (!context.user) throw new Error("Não autenticado.");
    const userId = context.user.id;
    const sql = `
            SELECT o.id, o.total_price, o.payment_method, o.shipping_address, o.created_at,
                   oi.quantity, oi.price as price_at_purchase,
                   p.id as product_id, p.name as product_name, p.imageUrl as product_imageUrl
            FROM orders o JOIN order_items oi ON o.id = oi.order_id JOIN products p ON oi.product_id = p.id
            WHERE o.user_id = ? ORDER BY o.created_at DESC;
        `;
    const [rows] = await db_gql.query(sql, [userId]);
    if (rows.length === 0) return [];

    const orders = rows.reduce((acc, row) => {
      if (!acc[row.id]) {
        acc[row.id] = {
          id: row.id,
          total_price: row.total_price,
          payment_method: row.payment_method,
          shipping_address: JSON.parse(row.shipping_address),
          created_at: row.created_at,
          items: [],
        };
      }
      acc[row.id].items.push({
        quantity: row.quantity,
        price_at_purchase: row.price_at_purchase,
        product: {
          id: row.product_id,
          name: row.product_name,
          imageUrl: row.product_imageUrl,
        },
      });
      return acc;
    }, {});
    return Object.values(orders);
  },
  favorites: async (args, context) => {
    if (!context.user) throw new Error("Não autenticado.");
    const userId = context.user.id;
    const sql = `
            SELECT p.* FROM products p 
            JOIN favorites f ON p.id = f.product_id 
            WHERE f.user_id = ?`;
    const [products] = await db_gql.query(sql, [userId]);
    return products;
  },
  orders: async ({ page = 1, limit = 5 }, context) => {
    if (!context.user) throw new Error("Não autenticado.");
    const userId = context.user.id;
    const offset = (page - 1) * limit;

    // Primeiro, conta o número total de pedidos do usuário
    const countSql =
      "SELECT COUNT(*) as totalCount FROM orders WHERE user_id = ?";
    const [countRows] = await db_gql.query(countSql, [userId]);
    const totalCount = countRows[0].totalCount;
    const totalPages = Math.ceil(totalCount / limit);

    // Depois, busca apenas os pedidos da página atual
    const ordersSql =
      "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?";
    const [orders] = await db_gql.query(ordersSql, [userId, limit, offset]);

    if (orders.length === 0) {
      return { orders: [], totalCount: 0, totalPages: 0 };
    }

    // Busca todos os itens e produtos para os pedidos da página atual
    const orderIds = orders.map((o) => o.id);
    const itemsSql = `
        SELECT oi.*, p.id as product_id, p.name as product_name, p.imageUrl as product_imageUrl
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id IN (?)
    `;
    const [items] = await db_gql.query(itemsSql, [orderIds]);

    // Agrupa os itens em seus respectivos pedidos
    const ordersWithItems = orders.map((order) => ({
      ...order,
      shipping_address: JSON.parse(order.shipping_address),
      items: items
        .filter((item) => item.order_id === order.id)
        .map((item) => ({
          quantity: item.quantity,
          price_at_purchase: item.price,
          product: {
            id: item.product_id,
            name: item.product_name,
            imageUrl: item.product_imageUrl,
          },
        })),
    }));

    return {
      orders: ordersWithItems,
      totalCount,
      totalPages,
    };
  },
  testDashboardData: async ({ limit = 20 }, context) => {
    if (!context.user || context.user.role !== "admin") {
      throw new Error("Acesso negado.");
    }

    try {
      const [latestRuns] = await db_gql.query(
        "SELECT * FROM test_runs ORDER BY created_at DESC LIMIT 1"
      );
      const [historicalRuns] = await db_gql.query(
        "SELECT * FROM test_runs ORDER BY created_at DESC LIMIT ?",
        [limit]
      );

      const formatRuns = async (runs) => {
        // Usamos Promise.all para buscar os detalhes de cada execução em paralelo
        return Promise.all(
          runs.map(async (run) => {
            const [testCases] = await db_gql.query(
              "SELECT * FROM test_case_results WHERE test_run_id = ?",
              [run.id]
            );
            return {
              ...run,
              created_at: run.created_at
                ? new Date(run.created_at).toISOString()
                : null,
              testCases: testCases, // Anexa os detalhes ao objeto de execução
            };
          })
        );
      };

      return {
        latestRun:
          latestRuns.length > 0 ? (await formatRuns(latestRuns))[0] : null,
        historicalRuns: await formatRuns(historicalRuns),
      };
    } catch (error) {
      console.error("Erro ao buscar dados do dashboard de testes:", error);
      throw new Error("Erro de servidor ao buscar dados do dashboard.");
    }
  },
};
