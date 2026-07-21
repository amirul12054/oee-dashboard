/// <summary>
/// A product/SKU that can run on one or more machines. Ideal Rate is
/// per-product (not just per-machine) since the same machine typically runs
/// at different rates for different products — this is what lets
/// Performance mean something on a multi-product line.
/// </summary>
public class ProductEntity
{
    public int Id { get; set; }
    public string Sku { get; set; } = "";
    public string Name { get; set; } = "";
    public int IdealRate { get; set; } // units/hour for this product, overrides the machine's default Ideal Rate when set as current product
    public bool IsActive { get; set; } = true;
}
