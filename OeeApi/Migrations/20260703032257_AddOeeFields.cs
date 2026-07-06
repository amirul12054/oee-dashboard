using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OeeApi.Migrations
{
    /// <inheritdoc />
    public partial class AddOeeFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ActualRate",
                table: "Machines",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "GoodUnits",
                table: "Machines",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "IdealRate",
                table: "Machines",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PlannedTimeMinutes",
                table: "Machines",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "RunTimeMinutes",
                table: "Machines",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ActualRate",
                table: "Machines");

            migrationBuilder.DropColumn(
                name: "GoodUnits",
                table: "Machines");

            migrationBuilder.DropColumn(
                name: "IdealRate",
                table: "Machines");

            migrationBuilder.DropColumn(
                name: "PlannedTimeMinutes",
                table: "Machines");

            migrationBuilder.DropColumn(
                name: "RunTimeMinutes",
                table: "Machines");
        }
    }
}
