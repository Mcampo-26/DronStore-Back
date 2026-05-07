import Cart from '../../models/Cart.js';

/**
 * Sincroniza el carrito del localstorage con la base de datos
 * POST /api/cart/sync
 */
export const syncCart = async (req, res) => {
  try {
    const { userId, cartItems } = req.body;

    if (!userId) return res.status(400).json({ msg: "ID de usuario requerido" });

    // Formateamos los items para que coincidan con el modelo (id -> producto)
    const formattedItems = cartItems.map(item => ({
      producto: item.id || item.producto,
      cantidad: item.quantity || item.cantidad
    }));

    // Buscamos el carrito del usuario y lo actualizamos, o lo creamos si no existe
    const updatedCart = await Cart.findOneAndUpdate(
      { usuario: userId },
      { items: formattedItems },
      { new: true, upsert: true }
    ).populate('items.producto', 'name price image stock');

    res.json({
      success: true,
      cart: updatedCart.items
    });
  } catch (error) {
    console.error("Error en syncCart:", error);
    res.status(500).json({ msg: "Error al sincronizar carrito" });
  }
};

/**
 * Obtiene el carrito guardado del usuario
 * GET /api/cart/:userId
 */
export const getCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const cart = await Cart.findOne({ usuario: userId })
      .populate('items.producto', 'name price image stock');

    if (!cart) {
      return res.json({ items: [] });
    }

    res.json(cart.items);
  } catch (error) {
    res.status(500).json({ msg: "Error al obtener carrito" });
  }
};